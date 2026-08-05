# Data

Sample data, metadata, and schemas will be placed here.

Do not commit private data, large datasets, or model weights.

## 종 마스터 적재용 파일

`plant_species` 마스터를 채우는 적재 파이프라인(`apps/api/scripts/ingest/`)이 읽는 파일들.

| 파일 | 소스 | 준비 방법 | 커밋 |
|---|---|---|---|
| `aspca-toxic-plants.csv` | ASPCA Toxic and Non-Toxic Plants | `python -m scripts.ingest.aspca_snapshot` 1회 실행 | O |
| `kfs-standard-plants.csv` | 산림청_표준식물종정보 | [data.go.kr 15092915](https://www.data.go.kr/data/15092915/fileData.do) 에서 수동 다운로드 후 이 이름으로 저장 | 용량 확인 후 결정 |

### aspca-toxic-plants.csv

ASPCA 는 OpenAPI 가 없어 목록 페이지를 읽어 만든 스냅샷이다. 적재 스크립트는 이 CSV 만
읽으므로 평시에는 네트워크가 필요 없다. 자료가 갱신됐을 때만 스냅샷 스크립트를 다시 돌린다.

컬럼: `sci_name_norm, sci_name, common_name_en, toxic_to_dogs, toxic_to_cats, toxic_to_horses, detail_url`

`toxic_to_*` 는 `true` / `false` / 빈 값(해당 동물 자료 없음) 세 가지다.
출처 표기 의무가 있으므로 앱에서 반려동물 안전 정보를 보여줄 때 ASPCA 출처를 함께 노출해야 한다.

### kfs-standard-plants.csv

data.go.kr 파일데이터라 API 다운로드가 안 되고 브라우저에서 직접 받아야 한다.
배포본마다 컬럼명이 조금씩 달라서, 적재 스크립트가 헤더를 못 찾으면 실제 헤더를 출력하고
멈춘다. 그때 `apps/api/scripts/ingest/kfs_file.py` 의 `HEADER_ALIASES` 에 별칭만 추가하면 된다.