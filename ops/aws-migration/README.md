# PostgreSQL AWS 이전

학교 PostgreSQL → AWS RDS 이전 절차의 DB 담당 부분. EC2 구축과 API 코드 분리 작업과
병행할 수 있는 구간을 앞으로 당겨 놓은 구성이다.

## 실행 순서

| 단계 | 스크립트 | 실행 위치 | 선행 조건 |
| --- | --- | --- | --- |
| 1. 백업 + 기준선 | `02-backup-source.ps1 -Label rehearsal` | 학교 Windows | 없음 |
| 2. 로컬 복원 리허설 | `03-rehearse-local.ps1` | 개발 PC (Docker) | 1단계 |
| 3. RDS 복원 리허설 | 아래 "RDS 리허설" 참고 | EC2 | RDS·VPC 생성 |
| 4. 최종 전환 | `02-backup-source.ps1 -Label final` → RDS | 학교 → EC2 | EC2·코드 완료, 팀 합의 |

1~2단계는 AWS 계정도 다른 담당자도 기다리지 않는다. 여기서 먼저 문제를 잡는다.

## 왜 백업을 두 번 뜨는가

리허설과 최종 전환 사이에 학교 DB 는 계속 쓰인다. 그동안 생기는 변경은 INSERT 만이
아니라 UPDATE·DELETE 도 포함된다. `created_at` 으로 차이분만 긁으면 수정·삭제분을
놓치고, 양쪽에 동시에 쓰면 `BIGSERIAL` 시퀀스가 각자 돌아 서로 다른 행이 같은 PK 를
갖게 되어 병합이 불가능해진다.

그래서 리허설 덤프(`-Label rehearsal`)와 최종 덤프(`-Label final`)를 분리한다.
최종 복원은 **쓰기 중지 직후 새로 뜬 덤프**로, **새로 만든 빈 DB** 에 한다.
리허설 DB 에는 폰 테스트 데이터가 섞여 있으므로 거기에 덮어쓰지 않는다.

## 파일

- `01-survey.sql` — 검증 기준선 조사. 원본과 복원 DB 에 같은 방식으로 실행해 출력을 비교한다.
  테이블 목록을 `information_schema` 에서 읽으므로 스키마가 바뀌어도 수정할 필요가 없다.
- `02-backup-source.ps1` — `pg_dump -Fc` + 목차 검사 + SHA-256 + 기준선 기록.
  `pg_dump` 가 서버보다 낮은 메이저 버전이면 중단한다.
- `03-rehearse-local.ps1` — 원본과 같은 메이저의 Docker PostgreSQL 에 복원하고
  앱 계정 권한까지 걸어 쓰기·시퀀스를 확인한다.

앱 계정 role/권한은 새로 만들지 않고 기존 `apps/api/scripts/db-setup.sql` 을 재사용한다.
role 이름은 `.env.example` 의 `DATABASE_URL` 과 같은 `leaflog_user` 이며, 대상 DB 만
`-v dbname=...` 로 바꿔 쓴다. 권한은 DB 단위이므로 **DB 를 새로 만들 때마다 다시 실행**해야 한다.

## 검증 방법

`01-survey.sql` 출력 두 개를 대조한다.

```powershell
Compare-Object (Get-Content survey-source.txt -Encoding UTF8) (Get-Content survey-restored-local.txt -Encoding UTF8)
```

| 섹션 | 차이가 나면 |
| --- | --- |
| 1. 서버/DB | 정상 — DB 이름·접속 계정·패치 버전은 다를 수 있다 |
| 2. 확장 | **비정상** — RDS 미지원 확장이면 이전 자체를 다시 설계해야 한다 |
| 3. 건수 | **비정상** — 복원 누락. 단, 원본이 계속 쓰이는 중이면 시점 차이일 수 있으니 재조사 |
| 4. 시퀀스 | **비정상** — 복원돼도 시퀀스가 어긋나면 첫 INSERT 부터 PK 충돌 |
| 5. 컬럼 | **비정상** — 스키마 드리프트. `docs/database-schema.sql` 과 대조 |
| 6~7. media_asset | S3 담당자와 대조용 기준값 |

`checksum` 컬럼에는 `face-v1:` 로 시작하는 얼굴 좌표가 들어 있다. 파일 해시가 아니므로
S3 이전 때 일반 해시로 덮어쓰면 캐릭터 표정이 깨진다. 7번 섹션이 그 분포를 보여준다.

## Docker 없이 리허설하기

`03-rehearse-local.ps1` 은 Docker Desktop 을 요구한다. 설치돼 있지 않으면 이미 설치된
로컬 PostgreSQL 서버에 **별도 DB 를 새로 만들어** 복원해도 리허설 목적은 달성된다.
검증되는 것(확장·소유권·`--single-transaction`·시퀀스·앱 계정 권한)이 같기 때문이다.

전제: 로컬 서버의 메이저 버전이 원본과 같아야 한다. 다르면 Docker 로 원본 버전을 띄우는
쪽이 맞다.

```powershell
$PgBin = 'C:\Program Files\PostgreSQL\18\bin'
$env:PGPASSWORD = '<로컬 postgres 비밀번호>'

# 같은 이름의 DB 가 없는지 먼저 확인 — 있으면 지우지 말고 다른 이름을 쓴다
& "$PgBin\psql.exe" -U postgres -d postgres -At -c "SELECT datname FROM pg_database WHERE datname = 'leaflog_rehearsal';"

& "$PgBin\createdb.exe" -U postgres leaflog_rehearsal
& "$PgBin\pg_restore.exe" -U postgres --dbname=leaflog_rehearsal --no-owner --no-acl --single-transaction --exit-on-error <덤프 경로>
& "$PgBin\psql.exe" -U postgres -d postgres -v app_pw='<임시 비밀번호>' -v dbname='leaflog_rehearsal' -f apps\api\scripts\db-setup.sql
& "$PgBin\psql.exe" -U postgres -d leaflog_rehearsal -f ops\aws-migration\01-survey.sql -o survey-restored-local.txt

Remove-Item Env:\PGPASSWORD
```

끝나면 리허설 DB 를 정리한다: `& "$PgBin\dropdb.exe" -U postgres leaflog_rehearsal`

## RDS 리허설 (3단계)

RDS 는 퍼블릭 액세스를 열지 않으므로 복원은 **VPC 안 EC2 에서** 실행한다. 개발 PC 에서
직접 접속하지 않는다. `01-survey.sql` 과 `apps/api/scripts/db-setup.sql` 을 EC2 로 옮기고,
원본과 같은 메이저의 `postgres` 컨테이너를 클라이언트로만 사용한다.

로컬 리허설이 통과했다면 RDS 에서 새로 확인할 것은 두 가지뿐이다.

- TLS: `sslmode=verify-full` + RDS CA 번들
- 확장 허용 목록: RDS 가 해당 확장을 지원하는지 (현재 스키마는 `pg_trgm` 하나)

## 코드 담당자에게 넘겨야 하는 사항

이 저장소에는 마이그레이션 도구(alembic 등)가 없고, 스키마는 `apps/api/app/main.py` 의
`Base.metadata.create_all()` 과 `apps/api/scripts/*.sql` 수동 패치로 관리된다. 이전과
관련해 코드 변경이 필요한 지점:

1. **`create_all()` 과 앱 계정 권한 충돌** — `leaflog_user` 에는 DDL 권한이 없다.
   테이블이 하나라도 없으면 startup 에서 권한 오류로 죽는다. 앱을 관리자 계정으로
   바꾸는 대신 운영에서 `create_all()` 을 끄거나 배포용 계정으로 분리해야 한다.
2. **9단계에서 추가되는 테이블** — 작업 상태 영속화용 새 테이블은 `create_all()` 에만
   의존하지 말고 `apps/api/scripts/` 에 `.sql` 패치로 함께 내야 한다. 그러면 복원
   시점과 무관하게 병행 작업이 가능하다.
