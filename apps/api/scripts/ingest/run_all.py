"""적재 파이프라인 전체 실행 — 소스 4개 적재 → 병합 → 한글 별칭 보강.

실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.run_all

각 단계는 독립적이라 하나가 실패해도 나머지는 계속 진행하고, 마지막에 요약을 출력한다.
준비물이 없는 단계(KFS CSV 미다운로드, NATURE 키 미발급)는 skip 으로 표시된다.
"""
import traceback

from . import aspca, kfs_file, merge, nature_kna, rda_indoor, wiki_ko_alias
from ._common import log

STEPS = [
    ("KFS_STD (산림청 CSV)", kfs_file.main),
    ("RDA_INDOOR (농사로 API)", rda_indoor.main),
    ("ASPCA (스냅샷 CSV)", aspca.main),
    ("NATURE_KNA (국립수목원 API)", nature_kna.main),
    ("MERGE (src_* → plant_species)", merge.main),
    # 마스터가 확정된 뒤에 — 병합 결과의 국명을 보고 부족한 별칭만 위키에서 채운다
    ("WIKI_KO_ALIAS (위키 한글 별칭)", wiki_ko_alias.main),
]


def main() -> None:
    results: list[tuple[str, str]] = []
    for name, func in STEPS:
        log(f"===== {name} =====")
        try:
            func()
            results.append((name, "OK"))
        except SystemExit as exc:
            # 준비물 없음 (CSV 미다운로드, 키 미설정 등) — 치명적이지 않음
            log(f"skip: {exc}")
            results.append((name, "SKIP"))
        except Exception:
            traceback.print_exc()
            results.append((name, "FAILED"))

    log("===== 요약 =====")
    for name, status in results:
        log(f"  {status:6} {name}")


if __name__ == "__main__":
    main()