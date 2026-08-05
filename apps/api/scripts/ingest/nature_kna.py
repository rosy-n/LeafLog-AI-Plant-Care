"""국가생물종지식정보시스템(nature.go.kr) 다운로드 파일 → src_nature_taxon.

국명/영문명/학명, 과 분류의 정본 소스. 자생·외래·재배 3개 파일을 한 테이블에 모은다.

준비:
  https://www.nature.go.kr/main/Main.do 에서 3개 파일을 내려받아 data/ 에 아래 이름으로 저장
    data/nature-native-plants.xls       자생식물
    data/nature-alien-plants.xls        외래식물
    data/nature-cultivated-plants.xls   재배식물
실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.nature_kna

파일이 레거시 .xls(BIFF8)로 내려오므로 xlrd 로 읽는다. CSV/xlsx 로 변환해 둔 경우
같은 이름의 .csv 가 있으면 그걸 우선 사용한다.

※ 이 파일들에는 자생지·원산지·분포 컬럼이 없다. 따라서 plant_species.origin /
  distribution 은 이 소스로 채워지지 않고, origin_country 는 RDA_INDOOR(orgplceInfo)
  단독으로 남는다. 분포 정보가 필요하면 국립수목원 오픈API 키 발급 후 별도 보강해야 한다.
"""
import csv

from app.models import SrcNatureTaxon

from ._common import DATA_DIR, Upserter, ingest_run, log, normalize_scientific_name, session

# 파일 → plant_group. 파일이 없으면 그 그룹만 건너뛴다.
FILES = {
    "nature-native-plants": "NATIVE",
    "nature-alien-plants": "ALIEN",
    "nature-cultivated-plants": "CULTIVATED",
}

# 다운로드 파일의 실제 헤더 (20컬럼)
COL_KO_NAME = "추천국명"
COL_KO_ALIAS = "비추천국명"
COL_EN_NAME = "추천영문명"
COL_SCI_NAME = "학명"
COL_SCI_FULL = "전체학명"
COL_FAMILY_KO = "과국명"
COL_GROUP = "식물분류"
COL_STATUS = "구분"

REQUIRED_COLUMNS = [COL_KO_NAME, COL_SCI_NAME, COL_FAMILY_KO, COL_GROUP, COL_STATUS]

# '구분' 이 정명인 행만 마스터에 반영한다 (이명 행이 섞이면 국명이 뒤집힌다)
ACCEPTED_STATUS = {"정명"}


def read_table(stem: str) -> list[dict] | None:
    """data/<stem>.csv 또는 .xls 를 읽어 dict 목록으로. 둘 다 없으면 None."""
    csv_path = DATA_DIR / f"{stem}.csv"
    if csv_path.exists():
        for encoding in ("utf-8-sig", "cp949", "utf-8"):
            try:
                with csv_path.open("r", encoding=encoding, newline="") as fp:
                    rows = list(csv.DictReader(fp))
                log(f"  {csv_path.name} ({encoding}) {len(rows)}행")
                return rows
            except UnicodeDecodeError:
                continue
        raise SystemExit(f"{csv_path.name} 인코딩을 판별할 수 없습니다.")

    xls_path = DATA_DIR / f"{stem}.xls"
    if not xls_path.exists():
        return None

    try:
        import xlrd
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "xlrd 가 필요합니다 (레거시 .xls 읽기용): pip install -r requirements.txt"
        ) from exc

    sheet = xlrd.open_workbook(xls_path).sheet_by_index(0)
    if sheet.nrows < 2:
        return []
    header = [str(sheet.cell_value(0, c)).strip() for c in range(sheet.ncols)]
    rows = [
        {header[c]: str(sheet.cell_value(r, c)).strip() for c in range(sheet.ncols)}
        for r in range(1, sheet.nrows)
    ]
    log(f"  {xls_path.name} {len(rows)}행")
    return rows


def build_source_key(group: str, row: dict) -> str | None:
    """파일에 ID 컬럼이 없어 학명+국명 복합키를 쓴다 (17,323건 전부 유일함을 확인).

    학명이 빈 행(재배식물 3건)은 국명만으로 키를 만든다.
    """
    ko_name = (row.get(COL_KO_NAME) or "").strip()
    sci_name = (row.get(COL_SCI_NAME) or "").strip()
    if not ko_name and not sci_name:
        return None
    return f"{group}:{sci_name or ko_name}|{ko_name}"[:200]


def first_english_name(raw: str | None) -> str | None:
    """추천영문명은 여러 이름을 ';' 또는 ',' 로 이어 준다 (최대 204자). 대표 하나만 쓴다.

    'common yarrow; devil's nettle; hundred-leaved grass; ...' → 'common yarrow'
    """
    if not raw:
        return None
    for separator in (";", ","):
        if separator in raw:
            raw = raw.split(separator)[0]
            break
    return raw.strip() or None


def to_values(group: str, row: dict) -> dict:
    sci_name = (row.get(COL_SCI_NAME) or "").strip() or None
    return {
        "ko_name": (row.get(COL_KO_NAME) or "").strip() or None,
        "en_name": first_english_name(row.get(COL_EN_NAME)),
        "sci_name": sci_name,
        "sci_name_norm": normalize_scientific_name(sci_name),
        "family_name": (row.get(COL_FAMILY_KO) or "").strip() or None,
        # 이 파일들에는 속(genus) 컬럼이 없다
        "genus_name": None,
        # 자생지/원산지/분포 컬럼도 없다 — 다른 소스가 채운다
        "native_habitat": None,
        "origin_country": None,
        "distribution": None,
        "plant_group": group,
        "payload": row,
    }


def main() -> None:
    tables: list[tuple[str, list[dict]]] = []
    missing: list[str] = []
    for stem, group in FILES.items():
        rows = read_table(stem)
        if rows is None:
            missing.append(stem)
            continue
        tables.append((group, rows))

    if not tables:
        raise SystemExit(
            "nature 파일이 없습니다. data/ 에 아래 이름으로 두세요 (.xls 또는 .csv):\n"
            + "\n".join(f"  {stem}.xls" for stem in FILES)
        )
    if missing:
        log(f"  없는 파일(해당 그룹 skip): {missing}")

    db = session()
    try:
        with ingest_run(db, "NATURE_KNA") as run:
            upsert = Upserter(db, SrcNatureTaxon)
            saved = 0
            skipped_status = 0
            for group, rows in tables:
                if rows:
                    absent = [c for c in REQUIRED_COLUMNS if c not in rows[0]]
                    if absent:
                        raise SystemExit(
                            f"{group} 파일에 필요한 컬럼이 없습니다: {absent}\n"
                            f"실제 헤더: {list(rows[0])}"
                        )

                for index, row in enumerate(rows, start=1):
                    if (row.get(COL_STATUS) or "").strip() not in ACCEPTED_STATUS:
                        skipped_status += 1
                        continue
                    source_key = build_source_key(group, row)
                    if not source_key:
                        continue
                    values = to_values(group, row)
                    values["ingest_run_id"] = run.run_id
                    upsert(source_key, values)
                    saved += 1
                    if index % 2000 == 0:
                        db.commit()
                        log(f"  {group} {index}/{len(rows)}")
                db.commit()
                log(f"  {group} 완료 (누적 {saved}건)")

            upsert.report()
            run.row_count = saved
            log(f"완료 — src_nature_taxon {saved}건 (정명 아님으로 제외 {skipped_status}건)")
    finally:
        db.close()


if __name__ == "__main__":
    main()