# Data

Sample data, metadata, and schemas will be placed here.

Do not commit private data, large datasets, or model weights.

## 종 마스터 적재용 파일

`plant_species` 마스터를 채우는 적재 파이프라인(`apps/api/scripts/ingest/`)이 읽는 파일들.

| 파일 | 소스 | 준비 방법 | 커밋 |
|---|---|---|---|
| `aspca-toxic-plants.csv` | ASPCA Toxic and Non-Toxic Plants | `python -m scripts.ingest.aspca_snapshot` 1회 실행 | O |
| `kfs-standard-plants.csv` | 산림청_표준식물종정보 | [data.go.kr 15092915](https://www.data.go.kr/data/15092915/fileData.do) 에서 수동 다운로드 후 이 이름으로 저장 | O (280KB) |
| `nature-native-plants.xls` | 국가생물종지식정보시스템 — 자생식물 | [nature.go.kr](https://www.nature.go.kr/main/Main.do) 에서 수동 다운로드 | 용량 확인 후 결정 |
| `nature-alien-plants.xls` | 국가생물종지식정보시스템 — 외래식물 | 위와 동일 | 위와 동일 |
| `nature-cultivated-plants.xls` | 국가생물종지식정보시스템 — 재배식물 | 위와 동일 | 위와 동일 |

### aspca-toxic-plants.csv

ASPCA 는 OpenAPI 가 없어 목록 페이지를 읽어 만든 스냅샷이다. 적재 스크립트는 이 CSV 만
읽으므로 평시에는 네트워크가 필요 없다. 자료가 갱신됐을 때만 스냅샷 스크립트를 다시 돌린다.

컬럼: `sci_name_norm, sci_name, common_name_en, toxic_to_dogs, toxic_to_cats, toxic_to_horses, detail_url`

`toxic_to_*` 는 `true` / `false` / 빈 값(해당 동물 자료 없음) 세 가지다.
출처 표기 의무가 있으므로 앱에서 반려동물 안전 정보를 보여줄 때 ASPCA 출처를 함께 노출해야 한다.

### nature-*-plants.xls

nature.go.kr 은 자생식물 / 외래식물 / 재배식물 3개 파일로 나뉘어 있고, 레거시 `.xls`(BIFF8)로
내려온다. 로더가 `xlrd` 로 직접 읽으므로 변환할 필요는 없다 (같은 이름의 `.csv` 를 두면 그걸 우선 사용).
파일 하나가 없으면 그 그룹만 건너뛴다.

- 자생식물 4,016행 / 외래식물 434행 / 재배식물 12,873행 = 17,323행
- **재배식물이 실내 관엽식물 커버리지의 핵심** (원예품종 5,532행 포함)
- 20컬럼: 식물분류, 추천국명, 비추천국명, 추천영문명, 비추천영문명, 종분류, 구분, 과명, 과국명,
  학명, 전체학명, 특산식물구분, 국가적색목록평가, 외래식물구분, 생태계교란종여부, 외래화우려여부,
  재배여부, 기본형태구분, 번식형태구분, 최종수정일
- `구분 = 정명` 인 행만 적재한다 (이명 행이 섞이면 국명 정본이 뒤집힘)
- ID 컬럼이 없어 `source_key` 는 `<그룹>:<학명>|<국명>` 복합키 (17,323건 전부 유일함을 확인)
- **자생지·원산지·분포 컬럼이 없다** → `plant_species.origin` / `distribution` 은 이 소스로
  채워지지 않고, `origin_country` 는 농사로(`orgplceInfo`) 단독으로 남는다

### kfs-standard-plants.csv

data.go.kr 파일데이터라 API 다운로드가 안 되고 브라우저에서 직접 받아야 한다.
배포본마다 컬럼명이 조금씩 달라서, 적재 스크립트가 헤더를 못 찾으면 실제 헤더를 출력하고
멈춘다. 그때 `apps/api/scripts/ingest/kfs_file.py` 의 `HEADER_ALIASES` 에 별칭만 추가하면 된다.