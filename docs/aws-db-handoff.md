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
| 6절 | 실행 | **대기 — 3-3 필요** |

## 2. 소윤: API `.env` 에 넣을 값

### 내가 제공

```
DATABASE_URL="postgresql://leaflog_app:<암호>@leaflog-db.cde6cma2gqp6.ap-northeast-2.rds.amazonaws.com:5432/leaflog_rehearsal?sslmode=verify-full&sslrootcert=/etc/leaflog/global-bundle.pem"
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

## 5. 미해결 3건

| 항목 | 담당 | 내용 |
|---|---|---|
| 진단 사진 7건 | 팀원 전원 | 서로 다른 이미지 **3개**만 찾으면 7건 다 통과 (해시 중복). 압축 없이 원본 파일로 전달 |
| 식물 사진 6건 | 소윤 | `file:///var/mobile/…` iOS 캐시 경로. 복구 불가. 지울지 결정 필요 |
| 재발 방지 | 소윤 | `generation` 없는 등록 경로가 클라이언트 URI 를 검증 없이 저장 중 |

진단 사진 대조용 해시:
```
8a8af9e138febf51ed2a605a33da674e92e136f717d4ea678607f38995728dbd  → asset 22,23,24,25
9d42e2d940959d2d6b12170a8f697ee32f6eadd61725b69af47ee83e0ab40889  → asset 26
939ca233a40b04d3fcf1d1b17e15c42c6ccafe31a3549d9ec937ad9a8e269257  → asset 32,33
```

6절 `plan` 예측: **entries 19 / skipped 13**. `apply-db` 는 skipped 가 1건이라도 있으면 거부한다.

건수·시퀀스·확장 집계는 `docs/aws-db-survey.sql` 로 재현한다. 원본과 복원 DB 에 같은 방식으로
실행해 출력을 비교하면 된다 (테이블 목록을 `information_schema` 에서 읽으므로 스키마가 바뀌어도
수정할 필요가 없다).

```
psql -h <host> -U <user> -d <db> -f docs/aws-db-survey.sql -o survey-<라벨>.txt
```

## 6. 최종 전환(13절) 때 반드시 반복해야 하는 것

리허설 산출물을 그대로 쓰면 안 되는 항목이다.

1. **덤프를 새로 뜬다.** 리허설 덤프에는 그 이후의 UPDATE·DELETE 가 없다
2. **새 빈 운영 DB** 에 복원한다. `leaflog_rehearsal` 에 덮어쓰지 않는다 (폰 테스트 데이터가 섞여 있다)
3. 운영 DB 에도 `character_job` 마이그레이션과 `leaflog_app` 권한을 **다시** 적용한다 (권한은 DB 단위)
4. 사진도 다시 백업한다. 복구한 2건은 학교 PC 에 배치해뒀으므로 자연히 포함된다
5. `migrate_media` 를 **운영 DB 대상으로 plan 재작성**한다 (문서 13-2 5번)
6. **skipped 13건을 학교 DB 에서 삭제한다.** 쓰기 중지(13-2 2번) 직후, 최종 백업(3번) **전에**
   실행한다. 스크립트는 `docs/aws-db-delete-skipped.sql`.
   - 대상: `PLANT_PHOTO` 6건(4,5,8,30,34,36) + `DIAGNOSIS_PHOTO` 7건(22~26,32,33)
   - 형태가 예상과 다르거나 건수가 13이 아니면 아무것도 지우지 않고 중단한다.
     그 사이 새 `file:///` 행이 생겼을 수 있으므로 1번 섹션 출력으로 건수를 다시 확인한다
   - `chat_message.asset_id` 는 nullable + SET NULL 이라 상담 대화 내용은 보존된다
   - 리허설 DB(`leaflog_rehearsal`)에서는 6절 진행을 위해 먼저 삭제한다
   - 학교 DB 는 팀 공용이라 개발 중에 지우지 않고 이 시점까지 미뤘다.
     접속이 막혀 있으면 `ops/school-gpu/configure-postgres-tailscale-client.ps1` 로
     현재 Tailscale IP 를 `pg_hba.conf` 에 등록해야 한다(`leaflog_user` 만 허용됨)

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
