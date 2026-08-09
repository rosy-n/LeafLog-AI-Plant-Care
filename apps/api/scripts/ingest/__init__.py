"""종 마스터(plant_species) 적재 파이프라인.

실행 순서:
    1. python -m scripts.ingest.kfs_file      산림청 표준식물종정보 CSV → src_kfs_species
    2. python -m scripts.ingest.rda_indoor    농사로 OpenAPI          → src_rda_indoor
    3. python -m scripts.ingest.aspca         ASPCA 스냅샷 CSV        → src_aspca_toxicity
    4. python -m scripts.ingest.nature_kna    국립수목원 API          → src_nature_taxon (키 없으면 skip)
    5. python -m scripts.ingest.merge         src_* → plant_species 병합
또는 python -m scripts.ingest.run_all 로 1~5 를 한 번에.

ASPCA 스냅샷 CSV 는 scripts.ingest.aspca_snapshot 을 1회 실행해 만들고 리포에 커밋한다.
"""