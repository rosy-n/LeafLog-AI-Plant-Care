# 지은 → 미나·소윤 인수인계 (DB·S3)

작성 2026-09-08 · 대상: `docs/aws-team-handoff.md` 3-1(RDS·S3), 4절, 5절, 6절

## 1. 완료 상태

| 절 | 내용 | 상태 |
|---|---|---|
| 3-1 | RDS 생성 | 완료 |
| 3-1 | S3 | **새로 만들지 않고 기존 버킷 재사용**으로 결정 |
| 4-1 | 원본 DB 백업·집계 | 완료 |
| 4-2 | 사진 백업 | 완료 |
| 4-4 | EC2 전송 | 완료 (해시 4/4 일치) |
| 5-1 | TLS·연결 확인 | 완료 (`verify-full` 통과) |
| 5-2 | 복원 + `character_job` | 완료 (오류 0) |
| 5-3 | `leaflog_app` 권한·건수 대조 | 완료 (원본과 값 일치) |
| 6절 | 권한 | 완료 (버킷 정책) |
| 6절 | 실행 (plan→upload→verify→apply-db) | 완료 |
| 재구축 | 9/11 학교 덤프로 리허설 DB 재작성 | 완료 — `leaflog_rehearsal2`, 22건 이전 (8절) |

## 2. 소윤: API `.env` 에 넣을 값

### 내가 제공

```
DATABASE_URL="postgresql://leaflog_app:<암호>@leaflog-db.cde6cma2gqp6.ap-northeast-2.rds.amazonaws.com:5432/leaflog_rehearsal2?sslmode=verify-full&sslrootcert=/etc/leaflog/global-bundle.pem"
S3_BUCKET="leaflog-dev-054422645032-ap-northeast-2-an"
S3_REGION="ap-northeast-2"
```

- `leaflog_app` 암호는 팀 비밀 저장소 참조. 문서에도 채팅에도 쓰지 말 것
- CA 번들은 EC2 의 `/etc/leaflog/global-bundle.pem` 에 이미 배치됨 (인증서 108개)
- **역할 이름이 `leaflog_app` 이다.** 저장소 `.env.example` 의 `leaflog_user` 가 아니다
  (핸드오프 문서 5-3 기준을 따랐음)

### 미나가 제공

```
CHARACTER_QUEUE_URL=   # https://sqs.ap-northeast-2.amazonaws.com/054422645032/leaflog-character-queue
AI_WORKER_URL=         # 학교 worker. https 또는 사설/Tailscale(100.64.0.0/10) 주소여야 함
QDRANT_URL=            # EC2 루프백
QDRANT_COLLECTION=
```

### 소윤이 정할 것 — 없으면 API 가 아예 시작하지 않는다

`config.validate_runtime("api")` 가 startup 에서 검사한다.

```
APP_ROLE="api"                     # 기본값 standalone. 이걸 안 바꾸면 create_all 이 돌고 S3 로컬 폴백이 살아난다
SECRET_KEY="<32자 이상>"            # "dev-only" 로 시작하면 거부
S3_PRESIGN="true"                  # 필수. false 면 시작 거부
CHARACTER_WORKER_TOKEN="<32자 이상>"
AI_WORKER_TOKEN="<32자 이상>"
```

기존 외부 API 키(`KMA_API_KEY`, `AIRKOREA_API_KEY`, `NONGSARO_API_KEY`, `NATURE_KNA_API_KEY`)도 담당자에게 인계받아야 한다.

### 기본값 그대로 두면 되는 것

문서 3-1·13-4 수치와 이미 일치한다.

```
CHARACTER_LEASE_SECONDS=180   CHARACTER_MAX_ATTEMPTS=3
CHARACTER_JOB_TIMEOUT_SECONDS=3600   CHARACTER_QUEUE_LIMIT=20
CHARACTER_DISPATCH_SECONDS=30   S3_PRESIGN_EXPIRE_SECONDS=3600
```

### 취소된 요청

전에 `create_all()` 이 앱 계정 DDL 권한과 충돌한다고 전달했는데, 배포 브랜치에서 이미 해결돼 있다.
`APP_ROLE=api` 면 `create_all` 을 호출하지 않고 마이그레이션 적용 여부만 검사한다. 대응 불필요.

## 3. 미나: 정보와 요청

- **`leaflog/rag/` 에 진단 참고 이미지 383개(737MB)가 이미 대상 버킷에 있다.** 7절에서 따로 옮길 필요 없음
- S3 권한은 **버킷 정책**으로 해결했다 (IAM 불필요). SQS 도 **대기열 정책**에 아래 Principal 을
  넣으면 3-2 의 그 부분이 IAM 없이 풀린다
  ```
  arn:aws:iam::054422645032:role/leaflog-api-ec2-role
  ```
- EC2 의 `~/.aws/credentials` 는 `credentials.disabled-20260907` 로 비활성화했다.
  정적 사용자 키가 인스턴스 역할을 가려서 `ForceMFA-Policy` 거부를 유발하고 있었다. 되살리지 말 것
- **3-3(docker·코드·venv) 이 6절의 마지막 블로커다.** 5절은 SSH 터널로 우회해 완료했다

## 4. 검증 기록

```
원본 DB      PostgreSQL 18.4 (학교 Windows)
RDS          PostgreSQL 18.6 / db.t4g.micro / 비공개 / 마스터 leaflog_admin
확장          pg_trgm 1.6, plpgsql 1.0          → RDS 지원, 블로커 없음
테이블        23개 원본과 건수 일치 + character_job(0) = 24개
             (docs/database-schema.sql 의 26개 중 notification·plant_character·push_token 은 미구현)
시퀀스        18개 복원 확인 (앱 계정 INSERT 로 실증)
덤프          3,408,690 B  sha256 3a50566ef439bf904cd157405258b7f7027f526ad89ff2f06401548843413326

EC2 ~/leaflog-migration/ (700)
  leaflog.dump         3a50566e…
  characters.tar.gz    022e864f…  파일 10개
  uploads.tar.gz       30bbb0bd…  파일 1개
  survey-source.txt    ea0ac5eb…  원본 집계 기록
```

### 6절 이전 결과 (2026-09-08)

```
plan      Ready: 19; manual review: 0
upload    19 assets verified; originals were not deleted
verify    19 assets verified
apply-db  19 assets verified

S3 대상    leaflog/migrated/<asset_id>/<sha256>   객체 19개
DB 갱신    bucket_name 채워진 행 19/19
           object_key 가 leaflog/migrated/… 인 행 19건
           file_url 에 옛 IP 호스트가 남은 행 0건
```

원본 객체(`leaflog/item-images/`)와 로컬 파일은 삭제하지 않았다.
media-root 는 EC2 의 `/srv/leaflog/migration/media-20260908` 이고,
계획 파일은 같은 디렉터리의 `media-plan-20260908.json` 이다.

**6절 명령은 모두 `sudo -u leaflog` 로 실행한다** — `/srv/leaflog` 가 `750 leaflog:leaflog` 라
`ubuntu` 로는 접근되지 않는다. 문서 6-2 의 `cd /srv/leaflog/app/apps/api` 를 그대로 실행하면
권한 오류가 난다. 자격증명은 인스턴스 역할을 쓰고, DB 접속 정보는
`/srv/leaflog/app/apps/api/.env`(600, leaflog 소유)에서 읽는다.

## 5. skipped 처리 결과와 남은 항목

`plan` 에서 skipped 로 빠지던 13건은 **삭제하기로 결정**했다. 리허설 DB 에서 제거한 뒤
`plan` 이 `Ready: 19; manual review: 0` 으로 통과했다.

| 항목 | 결정 | 상태 |
|---|---|---|
| `PLANT_PHOTO` 6건 | 삭제 | 리허설 DB 완료 / 학교 DB 는 13-2 에서 (6절 참고) |
| `DIAGNOSIS_PHOTO` 7건 | 삭제 | 같음. **팀원 파일 검색 요청은 취소됐다** |
| 재발 방지 | **미결 — 소윤** | `generation` 없는 등록 경로가 클라이언트 URI 를 검증 없이 저장 중. `bucket_from_url()` 이 `None` 이면 거절하는 가드가 필요하다 |

삭제된 13행은 `deleted-media-assets-RDS.csv` 와 `leaflog.dump` 에 원본이 남아 있다.
`chat_message` 5행의 `asset_id` 가 `NULL` 로 바뀌었고, 상담 대화 내용은 보존됐다.
`care_record`·`item` 에는 영향이 없었다.

건수·시퀀스·확장 집계는 `docs/aws-db-survey.sql` 로 재현한다. 원본과 복원 DB 에 같은 방식으로
실행해 출력을 비교하면 된다 (테이블 목록을 `information_schema` 에서 읽으므로 스키마가 바뀌어도
수정할 필요가 없다).

```
psql -h <host> -U <user> -d <db> -f docs/aws-db-survey.sql -o survey-<라벨>.txt
```

## 6. 최종 전환(13절) 때 반드시 반복해야 하는 것

리허설 산출물을 그대로 쓰면 안 되는 항목이다.

1. **덤프를 새로 뜬다.** 리허설 덤프에는 그 이후의 UPDATE·DELETE 가 없다
2. **새 빈 운영 DB** 에 복원한다. 리허설 DB 에 덮어쓰지 않는다 (폰 테스트 데이터가 섞여 있다)
3. 운영 DB 에도 `character_job` 마이그레이션과 `leaflog_app` 권한을 **다시** 적용한다 (권한은 DB 단위)
4. 사진도 다시 백업한다. 복구한 2건은 학교 PC 에 배치해뒀으므로 자연히 포함된다
5. `migrate_media` 를 **운영 DB 대상으로 plan 재작성**한다 (문서 13-2 5번)
6. **skipped 행을 학교 DB 에서 삭제한다.** 쓰기 중지(13-2 2번) 직후, 최종 백업(3번) **전에**
   실행한다. 스크립트는 `docs/aws-db-delete-skipped.sql`.
   - 대상을 **asset_id 로 고정하지 않고 형태로** 고른다. 등록이 늘면 목록이 달라지기 때문이다
     (9/07 13건 → 9/11 16건). 조건은 `PLANT_PHOTO` 의 `file:///var/mobile/…` 와
     `DIAGNOSIS_PHOTO` 의 `bucket_name IS NULL` + `/static/uploads/diagnosis/` 두 가지다
   - 이미 S3 로 이전된 행은 고르지 않는다. 대상이 100건을 넘으면 조건 오류로 보고 중단한다
   - 실행 전 1번 섹션 출력으로 건수와 내용을 반드시 확인한다
   - `chat_message.asset_id` 는 nullable + SET NULL 이라 상담 대화 내용은 보존된다
   - 학교 DB 는 팀 공용이라 개발 중에 지우지 않고 이 시점까지 미뤘다.
     접속이 막혀 있으면 `ops/school-gpu/configure-postgres-tailscale-client.ps1` 로
     현재 Tailscale IP 를 `pg_hba.conf` 에 등록해야 한다(`leaflog_user` 만 허용됨)
7. **캐릭터 파일이 학교 PC 에 없을 수 있다.** 개발 PC 에서 API 를 띄워 생성하면
   `CHARACTER_OUTPUT_DIR` 기본값 때문에 그 PC 에만 남는다. `plan` 이 `source unreadable` 로
   잡아주므로, 그때 해당 파일을 찾아 media-root 와 **학교 PC 양쪽에** 넣는다
   (학교에 넣어야 다음 백업에 자연히 포함된다)

## 7. 알아둘 것

- **퍼블릭 액세스 차단은 현재 꺼둔 상태다.** `S3_PRESIGN=true` 가 API 필수값이라 배포 후에는
  퍼블릭 정책이 불필요해진다. 앱에서 아이템 이미지가 보이는 걸 확인한 뒤 차단을 켜고
  `PublicReadItemImages` statement 를 제거하면 된다
- 원본(Windows)과 RDS(Linux)의 **collation 이 다르다.** 한글 `ORDER BY` 순서가 바뀐다.
  현재 앱 코드는 정수 기준으로만 정렬해 영향 없지만, 한글 이름 정렬을 추가하면 순서가 달라진다
- `character_job.user_id` 는 `INTEGER` 인데 `app_user.user_id` 는 `BIGSERIAL` 이다. 지금은 동작한다
- `character_job` 이 `docs/database-schema.sql` 에 없다. 문서 동기화 필요
- `media_asset` asset 28 의 checksum 이 **65자**다 (sha256 은 64자). 오타로 보이며 현재는
  정규식에 안 걸려 검사를 건너뛴다. checksum 을 신뢰하는 코드가 생기면 문제가 된다
- S3 에 `leaflog/migrated/_permcheck.txt` (0바이트 권한 검증용) 가 남아 있다. 삭제해도 된다

## 8. 2026-09-11 리허설 재구축

9/07 덤프가 9/08 캐릭터 리프레임 작업과 개체 17~19 추가보다 앞서 있어, 학교 DB 를 다시
덤프해 리허설 환경을 새로 만들었다.

### 결과

```
DB           leaflog_rehearsal2      (기존 leaflog_rehearsal 은 비교용으로 남겨둠)
테이블        26개 = 25 + character_job
             (plant_species_alias, plant_species_image 가 9/07 대비 새로 생김)
캐릭터 파일   23개 → media-root 27개 (복구 3건 포함)
이전 결과     plan Ready 22 / manual review 0 → upload → verify → apply-db 모두 22건
DB 검증       bucket_name 22/22, object_key 전부 leaflog/migrated/…,
             사설 IP 0건, file:// 0건
```

`.env` 는 DB 이름만 바꿨다(암호 동일). 백업은 같은 디렉터리의 `.env.bak-20260911`.

### 캐릭터 3건 복구

개체 17~19(야야·락락·야자야자)의 캐릭터가 `source unreadable` 로 빠졌다. 학교 PC 에도
없었고 **개발 PC 에서 API 를 띄워 생성해 그쪽에만 남아 있었다**. 파일을 찾아 media-root 와
학교 PC 양쪽에 배치했고, `face-v1` checksum 비교를 통과해 동일 파일임이 확인됐다.

```
plant 17 야야      asset 40  5de04b06…/candidate-1.png
plant 18 락락      asset 42  c7b86fb5…/candidate-1.png
plant 19 야자야자  asset 44  1963acf5…/candidate-2.png
```

9/08 에 학교 PC 로 옮겨둔 일지 사진과 `da0f9860` 캐릭터는 이번 백업에 자동 포함됐다.
학교에 배치해두는 방식이 실제로 효과가 있음을 확인한 셈이다.

### 삭제한 16건

`PLANT_PHOTO` 9건(4,5,8,30,34,36,**39,41,43**) + `DIAGNOSIS_PHOTO` 7건(22~26,32,33).
백업은 EC2 의 `/srv/leaflog/migration/deleted-media-assets-rehearsal2.csv`.
`chat_message` 5행의 `asset_id` 가 `NULL` 로 바뀌었다.

**`PLANT_PHOTO` 가 6건에서 9건으로 늘었다.** 39·41·43 이 개체 17~19 등록분이고 형태가
동일하다. 서버 가드가 없어 등록할 때마다 쌓인다 — 5절의 미결 항목이 그대로 재현됐다.

### 권한 변경 (리허설 DB 한정)

`leaflog_app` 에 **시퀀스 `UPDATE`** 를 추가했다. 없으면 `setval()` 을 못 돌려 데이터 전용
복원이 불가능하고, 그래서 팀원이 리허설 갱신을 스스로 못 한다.

```sql
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO leaflog_app;
```

앱 런타임은 `nextval()` 만 쓰므로 `USAGE` 로 충분하다. **13-2 의 운영 DB 는 문서 5-3 그대로
`USAGE, SELECT` 만 부여한다.** 리허설은 갱신이 반복되는 버리는 환경이라 트레이드오프가 반대다.

### 다음 갱신은 EC2 한 대에서 끝난다

학교 PC 에서 따로 덤프를 뜰 필요가 없다. 조건이 모두 확인됐다.

```
EC2 → 학교 PG 5432   도달 가능 (Tailscale)
EC2 → RDS 5432       도달 가능
EC2 에 postgres:18   있음
```

복원은 `leaflog_admin`(RDS 마스터)으로 해야 한다. `leaflog_app` 은 테이블을 소유하지 않아
스키마 복원이 안 되고, 데이터 전용 복원도 시퀀스 권한 없이는 `setval()` 에서 막힌다.
마스터 자격증명은 공유하지 말고 복원 담당이 직접 수행한다.
