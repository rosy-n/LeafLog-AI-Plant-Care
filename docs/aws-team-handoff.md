# AWS 이전 작업 가이드

작성: 소윤 · 기준일: 2026-09-10 · 대상: 미나, 지은, 소윤

### 바로가기

| 준비 | 이전·배포 | 검증·운영 |
|---|---|---|
| [담당과 순서](#1-담당과-작업-순서) | [RDS 복원](#5-지은-테스트-rds-복원) | [모바일 실행](#10-소윤팀원-모바일-실행) |
| [준비표](#2-시작-전-준비표) | [S3 이미지 이전](#6-지은-사진을-s3로-이전) | [통합 검증](#11-공동-통합-검증) |
| [AWS 준비](#3-미나지은-aws-환경-준비) | [Qdrant 복원](#7-미나-qdrant-복원) | [오류 확인표](#12-오류별-확인-순서) |
| [원본 백업](#4-지은미나-원본-백업) | [AWS API](#8-미나-aws-api-실행), [학교 worker](#9-미나-학교-ai-worker-연결) | [전환·복구](#13-최종-전환과-복구) |

## 0. 현재 상태와 작업 범위

| 항목 | 상태 |
|---|---|
| API·학교 AI 분리 코드 | develop `3245298` 변경과 생성 중지·오류 처리 보강을 AWS 이전 브랜치에 반영. 최종 서버 배포 전 단계 |
| 검사 | 백엔드 143개·모바일 53개 모의 테스트와 타입 검사 통과. 학교 실제 생성·폰 검증은 별도 |
| 인수인계 | 미나의 Notion 기록, 지은의 `docs/aws-db-handoff.md` 확인 |
| AWS 자원·데이터 | EC2·큐·테스트 RDS 복원 등 준비 내역 인계받음. 실제 서비스 연결 검증은 남음 |
| EC2 IAM | API 계정의 역할 선택, S3 3개 경로 쓰기·읽기·임시 GET, SQS 메시지 1건 발신 검사 통과 |
| 학교 SQS 인증 | 미준비 확인. EC2 역할이 학교 PC에도 적용되는 것은 아님. 9월 10일 큐는 SQS 관리형 암호화 확인, 현재 별도 KMS 권한 불필요 |
| EC2 설치 | API 전용 계정·Python 설치. 테스트 API는 루프백 유지, Nginx를 통한 HTTPS 접속 검증 완료 |
| EC2 테스트 | 별도 로컬 코드 사본으로 클라우드 모의 검사 23개 통과. 실제 테스트 RDS에 읽기 전용 API 시작·종료 확인 |
| RDS | 전체 백업 후 종 사진 테이블·BATHROOM 제약 보완 완료. 앱 계정의 모델 테이블·컬럼·DML 권한 재검사 통과. 기존 행 유지 |
| Tailscale·학교 연결 | 9월 8일 EC2 경유 SSH·worker 연결 통과. 9월 10일 재점검에서도 worker 연결 시간 초과. 전원·네트워크·Tailscale 확인 필요. 전원 꺼짐으로 단정하지 않음 |
| 학교 worker 배포 | 별도 테스트 서비스 설치·실행. 인증 health 200·비인증 401, EC2 경유 Ollama 실응답 확인(7.6초). 생성 중지·자동시작 비활성 |
| 학교 CLIP·RAG 연결 | worker 계정에 CLIP 준비·CPU 출력 확인. EC2 → 학교 CLIP 768차원 반환 → EC2 Qdrant 검색 200 확인(합성 이미지, 약 8.8초). 진단 정확도 검사는 별도 |
| 외부 API | Notion의 기상청·대기질·농사로 키를 EC2 비공개 설정에 반영. 예보·ASOS·대기질 측정값 조회 성공. 근처 측정소 검색은 제공 API에서 504 확인 |
| Qdrant | 학교와 같은 1.19.0으로 EC2 루프백에 복원. 191개 ID·벡터·payload 전체 대조 통과, 학교 원본 유지 |
| 이미지 이전 | 현재 테스트 DB의 이미지 19건을 S3로 복사·DB 경로 갱신. 서명 GET 실제 다운로드·해시·얼굴 좌표 보존 검증 통과 |
| API HTTPS | 공인 IP 무료 인증서 발급, 외부 HTTPS 200, 비인증 요청 401, 실험실·문서·HTTP API 차단 확인. 자동 갱신 모의 실행·재적용 통과, 4시간 점검 타이머 활성 |
| 실제 생성·폰 테스트 | 학교 재연결·학교 SQS 인증 발급 후 진행. 새 생성은 계속 중지 |

9월 10일 추가 보강: 새 작업 발신에 `DelaySeconds=0` 명시, 학교 worker의 인증 오류 재시도 및 큐 상태 표시 추가. 이 보강은 로컬 검사만 완료했으며 서버에는 아직 배포하지 않음. HTTPS·RDS·Qdrant 재점검에서 기존 데이터 유지 확인.

**최종 서비스 배포는 소윤이 통합 검증 완료 커밋 SHA를 공유한 뒤 진행.** 작업 브랜치는 `feature/aws-migration`. 이번 기록은 인증 발급 전까지 검증한 코드·설정 템플릿을 보관하는 단계이며, 브랜치 반영이 서버 자동 배포나 AWS 이전 완료를 뜻하지 않음. EC2에는 별도 테스트 사본이 실행 중이며 최신 브랜치 코드와 동일한 최종 배포본이 아님. 기존 학교 서비스와 `develop`은 유지.

테스트 서비스 이름은 `leaflog-api-rehearsal`, 환경 파일은 `/etc/leaflog/api-rehearsal.env`, 주소는 EC2 내부 `127.0.0.1:8000`. 생성은 `false`. Qdrant 컨테이너는 `leaflog-qdrant-rehearsal`, EC2 내부 `127.0.0.1:6333`에만 연결. 학교는 `leaflog-ai-worker-rehearsal`, 설정은 `/etc/leaflog/worker-rehearsal.env`. 아래 최종 설치 절차의 서비스 이름·경로와 구분하고 테스트 환경을 덮어쓰지 않음.

학교의 테스트 연결은 **Windows Tailscale 전용 18010 → WSL localhost 8010**. Windows 방화벽에서 EC2 장비 주소만 허용하고 나머지 IPv4 출발지는 차단하는 별도 규칙 적용. 기존 WSL 전달과 8010 포트가 충돌해 외부 포트만 분리했으며 기존 학교 API·DB 규칙은 유지. 이번 테스트에서는 Tailscale Serve를 사용하지 않았으므로 9-5절의 Serve 명령을 추가 실행하지 않음. 실제 IP와 규칙 이름은 비공개 운영 기록 참고.

새 worker 자동시작은 아직 비활성. 기존 학교 API가 새 GPU 잠금을 거치지 않으므로 두 환경의 생성·상담을 동시에 시험하지 않음. 최종 전환 시간에 기존 작업을 마친 뒤 자동시작·재부팅 복구를 별도 검증.

외부 키는 값 자체를 문서에 기록하지 않음. 기상청·대기질 클라이언트는 HTTPS로 전환하고 오류에 요청 URL·원문 응답을 노출하지 않도록 보완. 기상청 시간은 서버 시간대와 무관하게 한국 시간 기준. 관련 회귀 테스트 3개(6개 조회 경로의 오류 유형별 검사 포함)는 로컬·EC2에서 통과. 수목원 키는 이 페이지에서 확인되지 않았으며 기존 종 DB 조회에는 필수가 아님. PlantNet은 현재 모바일 직접 호출 구조이므로 이번 서버 설정에 혼합하지 않았고, 배포 전 서버 경유 전환 여부를 검토해야 함.

이번 이전의 범위는 다음과 같음.

| 실행 위치 | 역할 |
|---|---|
| AWS EC2 | FastAPI 실행, Qdrant 운영, HTTPS 제공 |
| AWS RDS | 계정·식물·기록·생성 작업 상태 저장 |
| AWS S3 | 사용자 사진, 생성 캐릭터, 이전한 이미지 파일 저장 |
| AWS SQS | 학교에 생성 작업 번호 전달 |
| 학교 PC | SDXL·LoRA·VAE·Canny, 누끼, 얼굴 제거, Ollama, CLIP 실행 |
| 팀원 PC | Expo 실행 |
| 휴대폰 | AWS API 요청, 이미지 조회 |

생성 흐름: 사진 접수 → S3에 원본 저장 → DB에 작업 기록 → SQS 전달 → 학교에서 후보 3개 생성 → S3에 결과 저장 → 앱에서 선택·등록.

상담은 AWS → 학교 Ollama, 사진 특징 추출은 AWS → 학교 CLIP. Qdrant 검색은 AWS에서 처리. 학교 PC 전원과 네트워크는 계속 필요.

이 문서의 기준 환경은 **새 Ubuntu 24.04 x86_64 EC2, 비공개 RDS·S3, 기존 학교 Windows + WSL**. 이미 준비된 자원이 있으면 재사용 가능 여부부터 확인. 기존 운영 자원에 설치·복원 명령을 그대로 실행하지 않음.

### 문서 사용 기준

- 단계마다 **담당 / 실행 위치 / 준비 조건 / 명령 / 완료 기준** 확인.
- `<...>`는 실제 값으로 교체. 실제 값은 비공개 운영 문서에 기록.
- 명령이 실패하면 해당 단계에서 중단. 권한 확대, 인증서 검증 해제, 기존 DB 삭제로 우회하지 않음.
- 코드·설정 템플릿은 저장소에 포함. 비밀번호·토큰·덤프·사진 백업은 별도 보관.
- 아래 절차는 적용용 문서이며 실제 실행 완료 기록이 아님.

### 0-1. 권한 승인 전 테스트

EC2 역할의 S3·SQS 접근 검사는 통과했고 학교의 SQS 인증이 남아 있음. 이 준비 때문에 API 설치와 일반 기능 검증까지 미룰 필요는 없음. **새 캐릭터 생성만 중지한 별도 테스트 환경**으로 시작. 권한을 우회하거나 실패한 요청을 계속 쌓는 방식이 아님.

1. EC2 실행 여부와 SSH 보안 그룹의 관리자 IP를 확인. `Connection timed out`은 키 인증 이전 단계의 실패이므로, 키 재발급보다 서버 상태·허용 IP·네트워크부터 확인. SSH를 인터넷 전체에 개방하지 않음.
2. 검수 완료 SHA를 받아 3-3절의 API 환경 설치. 기존 설치·설정이 있으면 먼저 확인하고 유지.
3. 지은의 [DB·S3 인수인계](aws-db-handoff.md) 기준으로 **테스트 RDS** 연결과 백업 건수 확인. 이미 복원한 DB를 다시 생성하거나 덮어쓰지 않음. 최신 develop에 추가된 테이블·제약은 아래 0-2절 점검.
4. 8절의 API 설정과 9절의 학교 worker 설정에 아래 값을 명시. API는 `/etc/leaflog/api.env`, 학교는 `/etc/leaflog/worker.env`.

   ```ini
   CHARACTER_GENERATION_ENABLED=false
   ```

5. 이 상태에서는 `CHARACTER_QUEUE_URL`, `CHARACTER_WORKER_TOKEN`, worker의 `CHARACTER_WORKER_API_URL`을 비워둘 수 있음. 학교의 SQS용 `AWS_PROFILE`·액세스 키 준비와 9-4절의 AWS 자격증명 검사는 보류. **API의 RDS·S3 설정과 양쪽의 동일한 `AI_WORKER_TOKEN`, API의 `AI_WORKER_URL`은 여전히 필요.**
6. 학교 worker 시험 시간은 팀원과 합의. 생성 중지 상태여도 시작 시 Ollama 모드를 복구하므로 기존 SDXL 작업과 동시에 시작하지 않음. 모델 경로·Python 환경·학교 네트워크 연결은 9절 기준으로 준비.
7. API·worker health와 실제 기능을 각각 확인한 뒤, 별도 Expo 실행 환경의 API 주소를 테스트 HTTPS 주소로 지정. 기존 학교용 Expo 설정을 덮어쓰지 않음.

| 기능 | 테스트에 필요한 조건 / 예상 동작 |
|---|---|
| 로그인·식물·돌봄 기록·일지 | RDS 스키마·앱 계정 권한·API 정상 연결 |
| 기존 이미지 표시·진단/일지 사진 업로드 | S3 객체 이전, 해당 실행 주체의 읽기/쓰기 권한 확인. 생성 중지 설정이 S3 권한을 대신하지 않음 |
| 식물 상담 | 학교 worker 인증·네트워크·Ollama 확인 |
| 사진 진단·유사 사례 검색 | 학교 CLIP·Ollama, EC2 Qdrant와 복원한 컬렉션 확인 |
| 식물명·환경 조회 | 각 외부 API 키와 네트워크 확인 |
| 새 캐릭터 생성·새 식물 등록 | 생성 중지 안내. 현재 등록 흐름은 캐릭터를 먼저 생성하므로 새 등록도 완료할 수 없음 |
| 이미 완료된 생성 결과 조회 | 조회 가능. 미완료 작업 조회는 중지 사유를 응답하고 새 작업을 추가하지 않음 |

생성 화면의 촬영 시작 시 `GET /api/character-generations/availability`로 설정 확인. 중지 상태면 촬영·업로드 전에 안내하고 재확인 가능. 상태 확인 중 네트워크·인증 오류를 정상 상태로 처리하지 않음. 생성 직전에 설정이 바뀌어도 서버가 요청을 503으로 거절. 구버전 학교 API가 이 경로를 제공하지 않는 경우(404)에만 기존 흐름 유지.

**생성 재개 순서:** API의 S3 읽기/쓰기·SQS 발신 권한, 학교의 SQS 수신/삭제/가시성 갱신 권한, callback HTTPS·토큰을 확인 → 학교 설정을 `true`로 변경하고 worker 재시작 → 큐 접근 오류가 없는지 확인 → API 설정을 `true`로 변경하고 API 재시작 → 테스트 계정으로 후보 3개 생성·선택·등록 검증. 양쪽 최종 설정은 동일해야 함.

중지 설정은 기존 작업 삭제나 강제 취소 기능이 아님. 이후 다시 중지할 때는 먼저 진행 작업을 정상 완료하고 양쪽을 `false`로 변경. 남아 있는 미완료 작업은 재개 후 재처리 또는 제한 시간에 따라 실패할 수 있으므로 작업 상태를 확인. DB·큐를 임의로 비우지 않음.

### 0-2. 인계받은 데이터 확인

- 상세 건수·원본 누락 목록은 `docs/aws-db-handoff.md` 기준. 실제 적용 경로·백업 해시는 비공개 운영 기록에 별도 보관.
- 9/8 최초 점검에서 빠져 있던 `plant_species_image`와 `BATHROOM` 위치 제약은 후속 승인 후 테스트 RDS에 보완. 현재 테이블 25개, 계정 8·식물 8·미디어 19·생성 작업 0·일지 및 일지 사진 각 1·종 사진 0. 모델 필수 테이블·컬럼과 앱 DML 권한 누락 없음. 조회 가능한 시퀀스의 USAGE 권한 검사 통과.
- 기존 `apps/api/scripts/` SQL을 RDS에 그대로 실행하지 않음. 일부 파일은 `\connect leaflog`로 학교용 DB명에 다시 접속하며, 종 사진 SQL에는 옛 데이터 삭제도 포함. 복원 DB의 위치 제약 이름은 `plant_location_name_check`로, 기존 스크립트의 `ck_plant_location_name`과 다름.
- 보완용 [테스트 RDS SQL](../apps/api/migrations/20260908_rehearsal_develop_schema.sql)은 `leaflog_rehearsal`에서만 실행되며 종 사진 테이블·권한 추가와 위치 제약 확장만 포함. 기존 행·테이블·컬럼 삭제와 DB 재접속 없음. 일회용 PostgreSQL 18에서 반복 실행·기존 행 유지·앱 삽입 권한·다른 DB 실행 차단 검증 후, 관리자 일회성 사용 승인을 받아 새 전체 백업을 만들고 **테스트 RDS 적용 완료**. 기존 24개 테이블 건수 유지 확인. 관리자 비밀번호는 서버 파일에 저장하지 않았으며 앱 계정에 DDL 권한을 추가하지 않음. 운영 DB에는 이 파일을 그대로 실행하지 않고 최종 복원 상태에 맞춰 별도 검수.
- 휴대폰 내부 `file:///...` 경로만 남은 과거 사진은 그 경로로 복구할 수 없음. 지은의 9월 8일 인수인계 기록에 따르면 누락 사진 13행은 테스트 RDS에서 별도 백업 후 제거했고, 학교 DB 처리는 최종 전환 시점으로 보류. 이번 코드 병합에서 삭제 SQL을 실행하지 않음. `media_asset.file_url`은 NOT NULL이므로 NULL로 바꾸는 쿼리도 적용하지 않음.
- AWS 신규 등록은 인증 사용자의 완료된 생성 작업에서 원본·캐릭터 S3 키를 가져옴. 앱이 보낸 로컬 파일 경로나 임의 캐릭터 URL은 저장하지 않도록 테스트로 확인. 이 규칙을 과거 학교 데이터에 일괄 적용한 것은 아님.
- 현재 백업은 테스트용 시점의 사본. 최종 전환 때 최신 원본을 다시 백업하고 새 운영 DB로 복원.
- 이미지 이전 전 테스트 RDS 전체 백업을 새로 생성하고 일회용 PostgreSQL 18에 실제 복원. 기존 24개 테이블 건수 대조 통과. 같은 데이터 사본에서 보완 SQL을 두 번 실행해 기존 행 유지 확인. 실제 RDS 스키마 변경과는 별개 검증.
- 이미지 이전 계획의 19건은 S3 복사·DB 경로 갱신·서명 GET 검증까지 완료. 이전 직전 대비 기존 테이블 건수와 checksum·얼굴 좌표 유지. 최초 인계의 32건과의 차이는 지은의 누락 사진 13행 정리 기록으로 확인. 상세 경로·해시는 비공개 운영 기록에 보관하며 이번 작업에서 누락 행을 추가 삭제하지 않음.

### 0-3. EC2 역할 연결 후 접근 검사

실행 위치: EC2. 준비 조건: SSH 연결, 검수 완료 코드·Python 설치, 대상 환경 파일 작성. 9/8 API 사용자 `leaflog`로 역할 선택과 아래 쓰기 검사를 실행해 통과. 테스트 객체 3개와 메시지 1건은 자동 삭제하지 않았고 비공개 실행 기록에 ID·경로 보관. 최종 설정 확정 후 필요할 때만 재검사. 실행할 때마다 새로운 테스트 객체·메시지가 만들어짐.

아래 명령은 최종 경로 `/srv/leaflog/app`, `/etc/leaflog/api.env` 기준. 현재 내부 테스트를 검사할 때는 작업 디렉터리를 `/srv/leaflog/rehearsals/20260908-api/apps/api`, 환경 파일을 `/etc/leaflog/api-rehearsal.env`로 바꿔 실행.

접속에 쓰는 `ubuntu` 사용자 대신 API 서비스와 같은 `leaflog` 사용자·환경 파일로 검사. 먼저 역할 선택만 확인. `<approved-role-name>`은 EC2에 연결된 실제 역할 이름으로 교체.

```bash
sudo systemd-run --wait --pipe --collect \
  --uid=leaflog --gid=leaflog \
  -p WorkingDirectory=/srv/leaflog/app/apps/api \
  -p EnvironmentFile=/etc/leaflog/api.env \
  /srv/leaflog/venv/bin/python -m scripts.check_aws_access \
  --expected-role '<approved-role-name>'
```

- `ec2-role: passed`: SDK가 인스턴스 역할을 선택했고 STS의 실제 역할이 일치. **S3·SQS 사용 권한까지 확인했다는 뜻은 아님.**
- 실패 시 환경 파일의 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_PROFILE` 및 서비스 사용자 프로필이 인스턴스 역할보다 먼저 선택되는지 확인. 키 내용을 출력하지 않음. 기존 설정을 자동 삭제하거나 인계 문서에 보관해둔 개인 자격증명을 다시 활성화하지 않음.
- 인스턴스 역할 자격증명은 EC2에서 SDK가 받아 사용. 학교 PC에 이 자격증명을 복사하지 않음. [AWS EC2 임시 자격증명](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html), [Boto3 자격증명 순서](https://docs.aws.amazon.com/boto3/latest/guide/credentials.html)

역할 확인 후, **설정된 버킷·큐가 테스트 대상인지 확인하고 쓰기 검사 승인을 받은 경우에만** 다음 실행.

```bash
sudo systemd-run --wait --pipe --collect \
  --uid=leaflog --gid=leaflog \
  -p WorkingDirectory=/srv/leaflog/app/apps/api \
  -p EnvironmentFile=/etc/leaflog/api.env \
  /srv/leaflog/venv/bin/python -m scripts.check_aws_access \
  --expected-role '<approved-role-name>' --write-test-probes
```

| 검사 | 실제 동작 |
|---|---|
| 저장 경로별 S3 | `leaflog/characters/`, `leaflog/diary/`, `diagnosis/` 아래 `_access-checks/<임의 ID>.txt` 1개씩 생성. 기존 객체 덮어쓰기 금지 |
| S3 읽기 | SDK로 방금 쓴 내용을 다시 읽어 비교 |
| 앱용 이미지 접근 | 임시 GET 주소로 실제 HTTP 요청 후 내용 비교. 주소 생성만으로 성공 처리하지 않음 |
| SQS 발신 | DB에 존재하지 않는 임의 작업 ID 1개 전송. 작업 DB 행·사진·생성 요청은 만들지 않음 |

결과의 `checks`와 `not_checked`를 함께 확인. `failed`가 있으면 종료 코드 1. 기본 모드의 종료 코드 0은 역할 검사만 통과했다는 뜻. 오류 응답 본문·비밀키·임시 URL은 출력하지 않음.

테스트 파일 3개는 `created_keys`로 확인. 자동 삭제하지 않으며, 쓰기 응답이 네트워크 문제로 유실되면 목록에 없는 테스트 객체도 남을 수 있음. 정리는 검사 경로·ID를 확인한 뒤 별도 진행. 전체 캐릭터 경로에 삭제·만료 규칙을 추가하지 않음. 메시지는 생성 기능과 worker를 활성화하면 존재하지 않는 작업으로 확인되어 제거되며 GPU 추론은 실행하지 않음. 그 전에는 큐에 남아 보존 기간 후 만료될 수 있음.

이 도구는 **학교의 SQS 수신·삭제·가시성 갱신, 학교에서의 임시 PUT 업로드, RDS, 실제 생성**을 검사하지 않음. 큐 속성 조회나 버킷 목록 조회 권한도 요구하지 않음. 실제 기능에 필요한 최소 권한으로 검사하며, 최종 확인은 후보 3개 생성·선택·등록 테스트로 진행.

신규 AWS 일지 사진은 `leaflog/diary/`에 저장. S3 저장 실패 시 503을 반환하고 외부에서 열 수 없는 서버 내부 파일로 대체하지 않음. 기존 학교 방식과 이전 `diary/` 객체·DB 기록은 유지. 승인된 정책 본문이 가이드의 경로 범위와 일치하는지도 실제 접근 검사에서 확인.

## 1. 담당과 작업 순서

| 담당 | 작업 | 다음 담당자에게 전달 |
|---|---|---|
| 미나 | EC2·HTTPS·Tailscale, Qdrant, SQS·IAM, API·학교 worker 설치 | API 주소, 큐·AI 연결 설정, 배포 SHA, 서비스 확인 결과 |
| 지은 | 원본 DB·사진 백업, RDS 복원, S3 이전, 데이터 검증 | DB 연결 설정, 버킷·리전, 건수·해시 검증 결과 |
| 소윤 | 코드 검수·공유, 설정 대조, 앱 통합 테스트·수정 | 배포 SHA, 테스트 결과, 남은 오류 |
| 공동 | 테스트 시간, 최종 전환, 백업·복구 책임 확정 | 전환 승인 및 복구 담당자 |

진행 순서:

1. **병렬 준비:** 미나는 3절의 AWS 환경, 지은은 4절의 DB·사진 백업 진행. Qdrant 백업은 미나 담당.
2. **코드 확보:** 검수 완료 SHA 수령 후 미나가 3-3절 실행. 이 단계부터 새 코드 필요.
3. **데이터 이전:** 지은은 5~6절, 미나는 7절 진행.
4. **서비스 연결:** 미나는 8~9절 진행. 기존 GPU 작업과 겹치지 않는 시간 확보.
5. **앱 검증:** 소윤과 팀원은 10~11절 진행.
6. **최종 전환:** 통합 테스트 통과 후 팀 승인, 13절 진행.

## 2. 시작 전 준비표

실제 값은 팀 비공개 운영 문서에 작성. 이 파일에 비밀번호를 채워 커밋하지 않음.

| 필요한 값 | 확인 담당 | 사용 위치 |
|---|---|---|
| AWS 계정·리전·예산·관리 권한 | 미나·지은 | 모든 AWS 자원 |
| EC2 접속 방식, SSH 키 또는 SSM | 미나 | 서버 설치·복원 |
| 테스트 API 도메인, DNS 수정 권한 | 미나 | HTTPS, 모바일, 학교 callback |
| 원본 PostgreSQL 버전·DB명·백업 계정 | 지은 | 원본 백업 |
| RDS 엔드포인트·테스트 DB명·앱 계정 | 지은 | AWS API, 이전 도구 |
| S3 대상 버킷·리전, 원본 버킷 접근 권한 | 지은 | 사진 복사·조회 |
| SQS 큐 URL·ARN, DLQ ARN | 미나 | API·worker·IAM |
| Qdrant 버전·컬렉션·인증·원본 건수 | 미나 | 스냅샷·복원 |
| 학교 Windows Tailscale IPv4, WSL 배포판·계정 | 미나 | 학교 AI 연결 |
| 학교 Python·Forge·모델·기존 서비스 경로 | 미나·소윤 | worker 설치 |
| 검수한 커밋 SHA | 소윤 | API·worker·모바일 공통 |
| 테스트 계정, 사용 가능한 식물 사진 | 소윤 | 통합 테스트 |

별도 난수 3개 준비: `SECRET_KEY`, `CHARACTER_WORKER_TOKEN`, `AI_WORKER_TOKEN`. 각각 최소 32자. 한 값을 세 용도로 재사용하지 않음.

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

각각 실행해 비밀 관리 수단에 저장. 출력은 공개 로그에 첨부하지 않음.

- `SECRET_KEY`: AWS API만 사용. 변경하면 기존 로그인 토큰이 만료되어 재로그인 필요.
- `CHARACTER_WORKER_TOKEN`: 학교 → AWS 작업 보고 인증. API와 worker 값 동일.
- `AI_WORKER_TOKEN`: AWS → 학교 상담·CLIP 인증. API와 worker 값 동일.
- 모바일에는 위 세 값과 DB·AWS 자격증명을 넣지 않음.
- 기존 날씨·대기질·식물 관련 외부 API 설정도 담당자에게 인계받음. 새 캐릭터 기능만 확인하고 누락하지 않음.

## 3. 미나·지은: AWS 환경 준비

### 3-1. AWS 콘솔 설정

담당: 미나(EC2·네트워크·SQS), 지은(RDS·S3). 비용과 자원 이름은 팀 합의 후 생성.

| 자원 | 설정 |
|---|---|
| EC2 | Ubuntu 24.04 LTS, x86_64, GPU 불필요. Qdrant·Python 설치 공간과 메모리 확보 |
| 네트워크 | EC2와 RDS는 같은 VPC. EC2는 인터넷 통신 가능, RDS는 비공개 |
| RDS PostgreSQL | 원본과 호환되는 메이저 버전, 암호화·자동 백업·삭제 방지. 테스트 DB에 먼저 복원 |
| S3 | 같은 리전, 퍼블릭 액세스 차단, 기본 암호화·버전 관리. 초기 검증은 SSE-S3 기준 |
| SQS | Standard 처리 큐와 Standard DLQ를 별도로 생성. 테스트용 큐 사용 |
| 도메인 | 테스트 API용 DNS A 레코드를 EC2의 고정 주소에 연결. 불필요한 AAAA 레코드 제거 |

콘솔 작업 순서:

1. 상단에서 팀 리전 선택. 기존 자원과 예산 확인.
2. VPC에서 EC2용·RDS용 보안 그룹 생성. 아래 포트 표 적용.
3. EC2 → 인스턴스 시작에서 Ubuntu와 EC2 보안 그룹 선택. SSH 키 또는 SSM 접속 확보. Elastic IP 연결 후 DNS A 레코드 설정.
4. RDS → 데이터베이스 생성에서 PostgreSQL 선택. 같은 VPC, 비공개 접근, RDS 보안 그룹 지정. 관리자 자격증명 별도 보관. 실제 앱용 테스트 DB는 5절에서 생성.
5. S3 → 버킷 만들기에서 같은 리전 선택. 퍼블릭 차단 유지, 버전 관리·암호화 설정 확인.
6. SQS → 대기열 생성에서 Standard DLQ를 먼저 생성. 이후 처리 큐를 만들고 해당 DLQ를 redrive 대상으로 연결. 아래 수치 입력.
7. 큐 상세 화면의 URL·ARN, RDS 엔드포인트, 버킷명, 리전을 비공개 준비표에 기록.

RDS 서브넷 그룹은 서로 다른 가용 영역의 서브넷 2개 이상 필요. DB 접근은 API 서버 보안 그룹으로 제한. [AWS RDS 네트워크 기준](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html)

| 허용 포트 | 범위 |
|---|---|
| EC2 80·443 | HTTPS 제공 및 인증서 발급에 필요한 외부 접근 |
| EC2 22 | 정해진 관리자 IP 또는 승인된 관리 경로만 허용 |
| RDS 5432 | API·이전 작업을 수행하는 EC2 보안 그룹만 허용 |
| Qdrant 6333 | EC2 루프백. 외부 개방 안 함 |
| 학교 AI 8010 | Tailscale에서 AWS API 장비만 허용 |
| Forge 7860·Ollama 11434 | 학교 내부 사용. 인터넷 공개 안 함 |

SQS 설정은 다음 값으로 통일.

| 항목 | 값 |
|---|---|
| 처리 큐 visibility timeout | 180초 |
| 작업 전달 지연 | 0초. API가 메시지마다 `DelaySeconds=0` 지정 |
| 수신 대기 | 20초 |
| 처리 큐 보존 | 4일 |
| DLQ 보존 | 14일 |
| 처리 큐 redrive maxReceiveCount | 10 |
| DB의 최대 생성 시도 | 총 3회. SQS 수신 횟수와 별개 |
| 작업 제한 시간 | 대기 포함 3,600초 |

큐 기본값이 달라도 코드에서 발신 `DelaySeconds=0`, 수신 `WaitTimeSeconds=20`을 지정. 긴 폴링은 메시지가 없을 때 기다리는 시간이며, 접수한 작업을 20초 지연시키는 설정이 아님. 추가 IAM 권한이나 큐 설정 변경 없이 적용 가능. 이 동작은 보강한 코드를 API와 학교 worker에 배포한 뒤부터 적용. [전달 지연](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-delay-queues.html), [긴 폴링](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-short-and-long-polling.html)

작업 중 worker가 가시성과 실행 임대를 갱신. SQS는 중복 전달 가능하므로 DB가 상태의 기준. 실패한 모든 작업이 반드시 DLQ로 이동하는 것은 아님. 앱의 최종 실패는 DB에서 확인. [가시성 제한](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html), [DLQ](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)

### 3-2. 권한 설정

IAM 콘솔에서 아래 작업을 **대상 큐 ARN·버킷 경로에만** 허용. 전체 관리자 권한으로 대체하지 않음.

| 실행 주체 | 필요한 권한 |
|---|---|
| API EC2 역할 | 처리 큐 `sqs:SendMessage`; 대상 버킷의 `leaflog/*`, `diagnosis/*`에 `s3:GetObject`, `s3:PutObject` |
| API의 기존 이미지 조회 | 유지할 원본 버킷·아이템 이미지 경로의 `s3:GetObject` |
| 학교 worker 전용 자격증명 | 처리 큐의 `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:ChangeMessageVisibility` |
| 이미지 이전 담당자 | 원본 파일의 `s3:GetObject`, 대상 `leaflog/migrated/*`의 `s3:GetObject`, `s3:PutObject` |
| 운영 조회 담당자 | 필요 시 대상 큐 `sqs:GetQueueAttributes`, 버킷 목록 조회 등 별도 읽기 권한 |

학교에는 DB 접속 정보나 S3 관리 권한을 부여하지 않음. 결과 업로드는 API가 발급한 임시 PUT 주소 사용. S3 주소는 서명한 API 역할의 권한과 유효기간에 종속. [S3 임시 주소](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

KMS 암호화를 별도로 선택했다면 사용 주체의 KMS 권한도 확인. 위 표만으로 KMS까지 허용되는 것은 아님.

EC2에는 IAM 역할 연결. 학교는 AWS 외부 장비이므로 전용 제한 권한 프로필 또는 갱신 가능한 임시 자격증명 준비. 학교 프로필 이름은 이 문서에서 `leaflog-school-worker`로 사용. 다른 이름이면 worker 설정도 수정.

권한 적용 순서:

1. IAM → 정책 생성에서 API용 정책과 학교용 정책을 분리. 서비스·작업·리소스를 위 표대로 지정. S3 객체 ARN은 `arn:aws:s3:::<bucket>/<prefix>/*`, 큐 ARN은 SQS 상세 화면 값 사용.
2. IAM → 역할 생성 → 신뢰할 수 있는 엔터티 `AWS 서비스` → `EC2` 선택. API용 정책 연결.
3. EC2 → 대상 인스턴스 → 작업 → 보안 → IAM 역할 수정에서 해당 역할 연결.
4. 학교는 기존 승인된 임시 자격증명 방식을 우선 사용. 테스트용 액세스 키를 사용할 경우 학교 전용 IAM 사용자에 학교용 정책만 연결하고, 콘솔 관리자 권한은 부여하지 않음. 보안 자격 증명에서 키 발급 후 9-4절의 비공개 프로필에 저장.
5. 이전용 원본 S3 권한은 지은의 실행 주체에만 추가. 이전 완료 후 더 이상 필요 없는 권한은 검토 후 회수.

공용 정책이나 기존 팀원 키를 변경하지 않음. 별도 권한 주체와 정책을 만들고 검증하는 방식으로 진행.

#### 학교 인증 요청 시 첨부할 내용

- [학교 worker 정책 예시](../ops/aws/iam/school-worker-policy.example.json)의 계정 ID·처리 큐 이름을 실제 값으로 교체. DLQ나 모든 큐를 허용하는 와일드카드로 확장하지 않음.
- 담당자에게 정책 연결뿐 아니라 **AWS 외부 학교 PC가 사용할 인증 방식**도 요청. 정책 파일만 받아서는 인증되지 않음.
- 기관에서 지원하는 무인 실행·자동 갱신 가능한 임시 인증을 우선 확인. IAM Roles Anywhere는 인증서와 신뢰 설정 등 별도 준비가 필요하며, EC2 역할 연결만으로 생기지 않음. 지원되지 않으면 학교 전용 제한 IAM 사용자 키를 테스트 기간에 허용하는지 담당자에게 확인. 개인 계정 키나 EC2 임시 자격증명을 복사하지 않음.
- S3·RDS·IAM 관리 권한, 큐 설정 변경·발신·DLQ 권한은 학교에 요청하지 않음. KMS 암호화 큐라면 실제 키 정책과 소비자의 복호화 권한은 추가 검토.
- 인증 정보를 받으면 실행 계정, 프로필 이름, 갱신·폐기 담당을 비공개 기록에 남기고 9-4절부터 진행. 사용자 로그인 세션 만료에 의존하는 방식은 상시 무인 실행 완료로 처리하지 않음.

[AWS 외부 워크로드 인증](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_non-aws.html), [SQS 권한 기준](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-api-permissions-reference.html)

### 3-3. EC2 패키지·코드 설치

담당: 미나. 위치: **새 AWS Ubuntu 터미널**. 준비: 검수 완료 SHA, 저장소 읽기 권한.

```bash
sudo apt-get update
sudo apt-get install -y git python3-venv python3-pip curl ca-certificates jq docker.io caddy
sudo systemctl enable --now docker
python3 --version
sudo docker --version
caddy version
```

기존 Docker 설치가 있으면 패키지 혼합 설치 중단. 이후 예시는 Python 3.12 기준. 의존성 설치 실패 시 오류를 공유하고 버전을 임의로 바꾸지 않음.

아래 계정·폴더가 이미 있으면 내용을 확인하고 경로를 별도로 결정. 신규 환경에서만 실행.

```bash
sudo useradd --system --create-home --home-dir /srv/leaflog --shell /usr/sbin/nologin leaflog
sudo -u leaflog git clone https://github.com/rosy-n/LeafLog-AI-Plant-Care.git /srv/leaflog/app
read -rp '검수한 커밋 전체 SHA: ' DEPLOY_COMMIT
sudo -u leaflog git -C /srv/leaflog/app checkout --detach "$DEPLOY_COMMIT"
sudo -u leaflog git -C /srv/leaflog/app rev-parse HEAD
sudo -u leaflog python3 -m venv /srv/leaflog/venv
sudo -u leaflog /srv/leaflog/venv/bin/python -m pip install -r /srv/leaflog/app/apps/api/requirements-api.txt
sudo -u leaflog /srv/leaflog/venv/bin/python -m pip check
```

비공개 저장소는 읽기 전용 deploy key 등 승인된 인증 필요. 토큰을 clone URL에 삽입하지 않음. 전체 저장소를 사용하며 `ai/persona-chat/prompts/`도 포함.

완료 기준: SHA 일치, `pip check` 오류 없음. EC2에는 `requirements-worker.txt`나 SDXL 모델 설치 불필요.

## 4. 지은·미나: 원본 백업

기존 서비스는 테스트 이전 기간 유지. 최종 전환 시에는 쓰기·생성을 멈추고 다시 백업. 초기 백업의 건수와 계속 사용 중인 DB의 현재 건수는 달라질 수 있음.

### 4-1. PostgreSQL 백업

담당: 지은. 위치: **학교 Windows PowerShell**. PostgreSQL 백업 도구는 원본과 같은 메이저 버전 우선.

```powershell
$PgBin = Read-Host 'PostgreSQL bin 폴더 전체 경로'
$SourceHost = Read-Host '원본 DB 호스트'
$SourceUser = Read-Host '백업 계정'
$SourceDb = Read-Host '원본 DB명'
$Backup = Join-Path $HOME ("LeafLogBackups\" + (Get-Date -Format yyyyMMdd-HHmmss))
New-Item -ItemType Directory -Path $Backup -ErrorAction Stop
& "$PgBin\pg_dump.exe" --version
& "$PgBin\psql.exe" -h $SourceHost -p 5432 -U $SourceUser -d $SourceDb -W -c 'SELECT current_database(), version();'
if ($LASTEXITCODE -ne 0) { throw '원본 연결 확인 실패' }
& "$PgBin\pg_dump.exe" -h $SourceHost -p 5432 -U $SourceUser -d $SourceDb -W -Fc -f (Join-Path $Backup 'leaflog.dump')
if ($LASTEXITCODE -ne 0) { throw '백업 실패' }
& "$PgBin\pg_restore.exe" --list (Join-Path $Backup 'leaflog.dump')
if ($LASTEXITCODE -ne 0) { throw '덤프 목차 확인 실패' }
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $Backup 'leaflog.dump')
```

포트가 5432가 아니면 실제 값으로 수정. 비밀번호는 프롬프트에서 입력. 바이너리 덤프를 PowerShell `>`로 저장하지 않음.

원본에 psql로 접속해 아래 결과를 기록.

```sql
SELECT current_database(), version();
SELECT extname, extversion FROM pg_extension ORDER BY extname;
SELECT 'app_user' AS table_name, count(*) AS rows FROM app_user
UNION ALL SELECT 'plant', count(*) FROM plant
UNION ALL SELECT 'plant_species', count(*) FROM plant_species
UNION ALL SELECT 'media_asset', count(*) FROM media_asset
UNION ALL SELECT 'care_record', count(*) FROM care_record;
SELECT asset_type, count(*) FROM media_asset GROUP BY asset_type ORDER BY asset_type;
```

전체 테이블 건수도 비교하려면 psql에서 다음 실행. `\gexec`는 앞 쿼리가 만든 읽기 전용 COUNT 문을 실행.

```sql
SELECT format('SELECT %L AS table_name, count(*) AS rows FROM %I.%I;',
              tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec
```

완료 기준: 덤프·SHA-256·DB 버전·확장 목록·테이블 건수 확보. 덤프에는 개인정보와 비밀번호 해시가 있으므로 비공개 보관.

### 4-2. 사진 백업

담당: 지은. 위치: **학교 WSL Ubuntu**. 아래는 기존 기본 경로. 실제 `CHARACTER_OUTPUT_DIR`이 다르면 그 경로를 사용.

```bash
read -rp '실제 캐릭터 저장 디렉터리: ' CHAR_ROOT
read -rp '실제 app/static/uploads 디렉터리: ' UPLOAD_ROOT
du -sh "$CHAR_ROOT" "$UPLOAD_ROOT"
umask 077
BACKUP="$HOME/leaflog-media-$(date +%Y%m%d-%H%M%S)"
mkdir "$BACKUP"
tar -czf "$BACKUP/characters.tar.gz" -C "$CHAR_ROOT" .
tar -czf "$BACKUP/uploads.tar.gz" -C "$UPLOAD_ROOT" .
sha256sum "$BACKUP/characters.tar.gz" "$BACKUP/uploads.tar.gz"
```

없는 경로는 실제 파일 소유 PC·버킷부터 확인. 빈 폴더를 만들어 백업 완료로 처리하지 않음. 기존 S3 파일은 버킷·키와 접근 권한 확보. 앱에 내장된 표정·효과 PNG는 코드로 배포하며 중복 이전하지 않음.

### 4-3. Qdrant 백업

담당: 미나. 위치: **원본 Qdrant에 접근 가능한 Linux 터미널**. `curl`, `jq` 필요.

```bash
umask 077
QBACKUP="$HOME/leaflog-qdrant-$(date +%Y%m%d-%H%M%S)"
mkdir "$QBACKUP"
read -rp '원본 Qdrant URL: ' SOURCE_QDRANT
read -rp '컬렉션 이름: ' COLLECTION
read -rsp 'Qdrant API 키, 없으면 엔터: ' QDRANT_KEY
printf '\n'
qcurl() {
  printf 'header = "api-key: %s"\n' "$QDRANT_KEY" |
    curl --config - --fail --silent --show-error "$@"
}
qcurl "$SOURCE_QDRANT/" > "$QBACKUP/version.json"
qcurl "$SOURCE_QDRANT/collections/$COLLECTION" > "$QBACKUP/collection.json"
qcurl -X POST "$SOURCE_QDRANT/collections/$COLLECTION/points/count" \
  -H 'Content-Type: application/json' -d '{"exact":true}' > "$QBACKUP/count.json"
qcurl -X POST "$SOURCE_QDRANT/collections/$COLLECTION/snapshots?wait=true" > "$QBACKUP/snapshot.json"
SNAPSHOT=$(jq -er '.result.name' "$QBACKUP/snapshot.json")
qcurl "$SOURCE_QDRANT/collections/$COLLECTION/snapshots/$SNAPSHOT" -o "$QBACKUP/qdrant.snapshot"
sha256sum "$QBACKUP/qdrant.snapshot"
unset QDRANT_KEY
```

각 명령 성공 확인 후 다음 명령 실행. 컬렉션이 여러 개면 각각 백업. API 키는 명령 이력·프로세스 인자에 직접 넣지 않음.

완료 기준: 서버 버전·벡터 설정·정확한 point 수·스냅샷 확보. 스냅샷에는 외부 참고 이미지 파일이 포함되지 않으므로 payload의 이미지 주소·사례 연결도 점검. [스냅샷 생성 API](https://api.qdrant.tech/api-reference/snapshots/create-snapshot)

### 4-4. EC2로 전달

담당: 지은·미나. 위치: **AWS Ubuntu**에서 수신 폴더 준비.

```bash
umask 077
mkdir -p "$HOME/leaflog-migration"
```

승인된 SSH/SFTP 경로로 다음 파일 전달.

- `leaflog.dump`, 원본 DB 집계 결과
- `characters.tar.gz`, `uploads.tar.gz`
- `qdrant.snapshot`, `version.json`, `collection.json`, `count.json`
- 각 파일의 SHA-256 기록

Windows 전송 예시. 실제 경로와 서버 주소로 교체.

```powershell
scp -i '<EC2_PRIVATE_KEY_PATH>' '<BACKUP_PATH>\leaflog.dump' 'ubuntu@<EC2_HOST>:leaflog-migration/leaflog.dump'
if ($LASTEXITCODE -ne 0) { throw '전송 실패' }
```

WSL 백업은 WSL에서 scp를 사용하거나 승인된 SFTP 도구로 전달. 개인 PC에 받은 경우 다시 공개 저장소에 넣지 않음.

EC2에서 `sha256sum`으로 원본과 대조. 불일치하면 복원 중단.


## 5. 지은: 테스트 RDS 복원

위치: **AWS Ubuntu**. 준비: 3-3절 코드·Docker 설치, 4절 백업, 비공개 RDS 연결.

### 5-1. TLS와 DB 도구 준비

```bash
sudo install -d -m 0755 /etc/leaflog
sudo curl --fail --silent --show-error \
  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  -o /etc/leaflog/global-bundle.pem
sudo chmod 0644 /etc/leaflog/global-bundle.pem
read -rp 'RDS 엔드포인트: ' PGHOST
read -rp '복원·마이그레이션 계정: ' PGUSER
read -rp '원본과 맞춘 PostgreSQL 메이저 버전: ' PG_MAJOR
pgtool() {
  sudo docker run --rm -it --network host \
    -e PGHOST="$PGHOST" -e PGUSER="$PGUSER" -e PGPORT=5432 \
    -e PGSSLMODE=verify-full -e PGSSLROOTCERT=/etc/leaflog/global-bundle.pem \
    -v /etc/leaflog/global-bundle.pem:/etc/leaflog/global-bundle.pem:ro \
    -v "$HOME/leaflog-migration:/backup:ro" \
    -v /srv/leaflog/app:/repo:ro \
    "postgres:$PG_MAJOR" "$@"
}
pgtool psql -W -d postgres -c 'SELECT current_database(), version();'
```

컨테이너는 PostgreSQL **클라이언트 도구만 실행**. 새 DB 서버를 띄우는 명령이 아님. 새 SSH 세션에서는 변수와 함수를 다시 설정.

완료 기준: 지정한 RDS에 연결, TLS 인증서 검증 성공. 호스트를 임의 IP로 바꾸거나 `verify-full`을 끄지 않음. [RDS TLS 연결](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html)

### 5-2. 새 테스트 DB 생성·복원

이 문서의 테스트 DB명은 `leaflog_rehearsal`. 이름을 바꾸면 이후 명령·환경 설정도 함께 변경.

```bash
pgtool psql -v ON_ERROR_STOP=1 -W -d postgres
```

psql 안에서 실행.

```sql
SELECT datname FROM pg_database WHERE datname = 'leaflog_rehearsal';
```

결과가 **0행일 때만** 다음 실행. 이미 있으면 삭제하지 말고 소유자·용도를 확인.

```sql
CREATE DATABASE leaflog_rehearsal;
\q
```

AWS Ubuntu에서 실행.

```bash
pgtool pg_restore --list /backup/leaflog.dump
pgtool pg_restore -W --dbname=leaflog_rehearsal \
  --no-owner --no-acl --single-transaction --exit-on-error /backup/leaflog.dump
pgtool psql -v ON_ERROR_STOP=1 -W -d leaflog_rehearsal \
  -f /repo/apps/api/migrations/20260907_character_jobs.sql
```

기존 표정·효과 컬럼은 변경하지 않고 `character_job` 테이블 추가. `--clean`, DB 삭제, 오류 무시 후 진행 금지.

### 5-3. 앱 계정과 검증

```bash
pgtool psql -v ON_ERROR_STOP=1 -W -d leaflog_rehearsal
```

```sql
SELECT rolname FROM pg_roles WHERE rolname = 'leaflog_app';
```

없을 때만 `CREATE ROLE`과 `\password` 실행. 기존 계정이면 임의로 비밀번호 변경 금지.

```sql
CREATE ROLE leaflog_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password leaflog_app
GRANT CONNECT ON DATABASE leaflog_rehearsal TO leaflog_app;
GRANT USAGE ON SCHEMA public TO leaflog_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO leaflog_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO leaflog_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO leaflog_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO leaflog_app;
\d character_job
\q
```

기본 권한은 해당 명령을 실행한 역할이 나중에 생성하는 객체에 적용. 다른 마이그레이션 계정을 사용하면 그 역할의 기본 권한도 설정.

4-1절 집계를 복원 DB에서 다시 실행. 새 `character_job`을 제외한 원본 테이블의 건수 대조. 계정·식물·일지·상담·꾸미기 관계도 표본 확인. 원본에 없는 확장을 임의로 제거해 복원하지 않음.

완료 기준: 복원 오류 없음, 작업 테이블 존재, 앱 계정으로 읽기·쓰기 가능, 건수 일치. FastAPI 운영 모드는 테이블을 자동 생성하지 않음.

## 6. 지은: 사진을 S3로 이전

위치: **AWS Ubuntu**. 준비: 복원 DB, 원본 사진, 이전용 IAM 권한, API Python 환경.

### 6-1. 원본 폴더 복원

신규 빈 디렉터리 사용. 압축 목록에 절대 경로나 `../`가 없는지 먼저 확인.

```bash
tar -tzf "$HOME/leaflog-migration/characters.tar.gz" | head -n 20
tar -tzf "$HOME/leaflog-migration/uploads.tar.gz" | head -n 20
MROOT="$HOME/leaflog-migration/media-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$MROOT/generated/characters" "$MROOT/app/static/uploads"
tar -xzf "$HOME/leaflog-migration/characters.tar.gz" -C "$MROOT/generated/characters"
tar -xzf "$HOME/leaflog-migration/uploads.tar.gz" -C "$MROOT/app/static/uploads"
```

4-2절 방식으로 만든 압축 기준. 이전에 다른 방식으로 압축한 파일이라면 중복 `characters/characters` 폴더가 생기지 않게 구조 확인.

최종 경로:

```text
<media-root>/generated/characters/<job-id>/*.png
<media-root>/app/static/uploads/...
```

### 6-2. 이전 작업의 접속 정보

```bash
cd /srv/leaflog/app/apps/api
PY=/srv/leaflog/venv/bin/python
read -rsp '복원한 테스트 DB의 앱용 DATABASE_URL: ' DATABASE_URL
printf '\n'
export DATABASE_URL
read -rp '대상 S3 버킷: ' MEDIA_BUCKET
read -rp 'S3 리전: ' S3_REGION
export S3_REGION
read -rp '이전용 AWS 프로필, EC2 역할 사용 시 엔터: ' MIGRATION_PROFILE
if [ -n "$MIGRATION_PROFILE" ]; then
  export AWS_PROFILE="$MIGRATION_PROFILE"
else
  unset AWS_PROFILE
fi
"$PY" -c 'import boto3; print(boto3.client("sts").get_caller_identity()["Arn"])'
"$PY" -c 'from app.database import engine; from sqlalchemy import text; c=engine.connect(); print(c.execute(text("select current_database(), current_user")).one()); c.close()'
```

`DATABASE_URL` 형식은 8-1절 참고. 반드시 테스트 DB명이 출력되어야 함. 다른 DB면 중단. 이전용 AWS 프로필은 담당자가 사전에 준비한 것만 사용. S3 원본 읽기 권한은 API의 기본 권한에 없을 수 있음.

실제 비밀번호가 포함된 URL은 화면 공유 중 입력하지 않음. 환경 변수는 이 터미널에만 적용되며 systemd API 서비스 설정과 별개.

### 6-3. 계획·복사·검증·DB 반영

```bash
PLAN="$HOME/leaflog-migration/media-plan-$(date +%Y%m%d-%H%M%S).json"
"$PY" -m scripts.migrate_media plan --media-root "$MROOT" \
  --bucket "$MEDIA_BUCKET" --manifest "$PLAN"
jq '{ready:(.entries|length), skipped:.skipped}' "$PLAN"
```

정상 결과: `Ready: N; manual review: 0`.

`skipped`가 있으면 원본 파일, 버킷 권한, URL 매핑, 해시 불일치 확인. 외부 URL·휴대폰 로컬 주소는 자동 다운로드 대상이 아님. 해결되지 않는 asset ID는 소윤에게 전달해 매핑 검토. `skipped` 항목을 지워 강제로 통과시키지 않음.

계획 파일은 덮어쓰지 않으므로 수정 후 재계획 시 새 파일명 사용. 문제가 없는 계획에만 다음 실행.

```bash
"$PY" -m scripts.migrate_media upload --media-root "$MROOT" --manifest "$PLAN"
"$PY" -m scripts.migrate_media verify --manifest "$PLAN"
"$PY" -m scripts.migrate_media apply-db --confirm-restored-db --manifest "$PLAN"
```

| 단계 | 변경 범위 |
|---|---|
| plan | DB·원본 읽기, 로컬 JSON 보고서 생성 |
| upload | S3에 새 키로 복사. DB 변경 없음 |
| verify | 업로드 파일의 실제 내용·크기·SHA-256 확인 |
| apply-db | 계획 당시 값과 일치하는 DB 행만 트랜잭션으로 갱신 |

완료 기준: 각 명령 성공, `N assets verified`, 누락 0. 동일 계획의 업로드 재실행은 기존 대상 내용 검증 후 진행. 원본 파일은 삭제하지 않음.

`asset_id`, 식물·아이템 연결, `checksum`의 `face-v1:` 얼굴 좌표는 보존. DB에는 `s3://bucket/key` 식별자를 저장하고 앱에 반환할 때 임시 HTTPS 주소 발급. 만료 주소를 DB에 고정 저장하지 않음.

보고서에는 이전 주소가 있으므로 비공개 보관. 작업 종료 후 해당 터미널의 `DATABASE_URL`, `AWS_PROFILE` 등 비밀 설정 해제 또는 세션 종료.

## 7. 미나: Qdrant 복원

위치: **AWS Ubuntu**. 준비: 원본 버전·스냅샷·건수. 기존과 같은 Qdrant 버전으로 복원하며 임베딩 모델·차원은 변경하지 않음.

아래 이름의 컨테이너·볼륨이 이미 있으면 중단 후 용도 확인. 신규 환경에만 실행.

```bash
sudo docker ps -a --filter name=leaflog-qdrant
sudo docker volume ls --filter name=leaflog-qdrant-data
read -rp '원본 Qdrant 이미지 태그, 예: v1.x.y: ' QDRANT_VERSION
sudo docker volume create leaflog-qdrant-data
sudo docker run -d --name leaflog-qdrant --restart unless-stopped \
  -p 127.0.0.1:6333:6333 \
  -v leaflog-qdrant-data:/qdrant/storage \
  "qdrant/qdrant:$QDRANT_VERSION"
curl --fail --silent --show-error http://127.0.0.1:6333/
read -rp '원본 컬렉션 이름: ' COLLECTION
curl --fail --silent --show-error http://127.0.0.1:6333/collections
```

복원 대상 컬렉션이 없는 새 테스트 인스턴스에서만 다음 실행.

```bash
curl --fail --silent --show-error -X POST \
  "http://127.0.0.1:6333/collections/$COLLECTION/snapshots/upload?priority=snapshot&wait=true" \
  -F "snapshot=@$HOME/leaflog-migration/qdrant.snapshot"
curl --fail --silent --show-error "http://127.0.0.1:6333/collections/$COLLECTION"
curl --fail --silent --show-error -X POST \
  "http://127.0.0.1:6333/collections/$COLLECTION/points/count" \
  -H 'Content-Type: application/json' -d '{"exact":true}'
```

완료 기준: 복원 성공, point 수·벡터 설정 일치, 실제 사례 검색·참고 이미지 접근 가능. 과거 191건 기록이 아니라 **이번 백업의 실제 건수**와 대조. [Qdrant 복원 API](https://api.qdrant.tech/api-reference/snapshots/recover-from-uploaded-snapshot)

이 예시는 EC2 루프백 전용 Qdrant이며 `QDRANT_API_KEY`는 빈 값. 다른 서버에 띄우거나 외부 접근이 필요하면 인증·네트워크를 별도로 구성. 스냅샷의 payload URL은 자동 치환되지 않으며, 6절 도구는 PostgreSQL의 `media_asset`만 처리.

## 8. 미나: AWS API 실행

준비: 5~7절 완료, API IAM 역할, 학교 Windows Tailscale IPv4 확보. 학교 worker는 9절에서 연결하므로 이 단계의 health 성공만으로 AI 준비 완료 처리하지 않음.

### 8-1. API 환경 파일

위치: **AWS Ubuntu**. 새 파일이면 저장소 템플릿에서 복사. 기존 파일이면 백업 후 필요한 값만 편집.

```bash
sudo install -d -m 0755 /etc/leaflog
if ! sudo test -e /etc/leaflog/api.env; then
  sudo install -m 0600 -o root -g root \
    /srv/leaflog/app/ops/aws/api/.env.example /etc/leaflog/api.env
fi
sudoedit /etc/leaflog/api.env
```

필수 설정:

```ini
APP_ROLE=api
DATABASE_URL=postgresql+psycopg://leaflog_app:<encoded-password>@<rds-endpoint>:5432/leaflog_rehearsal?sslmode=verify-full&sslrootcert=/etc/leaflog/global-bundle.pem
SECRET_KEY=<api-jwt-secret>
S3_BUCKET=<target-bucket>
S3_REGION=ap-northeast-2
S3_PRESIGN=true
S3_PRESIGN_EXPIRE_SECONDS=3600
CHARACTER_QUEUE_URL=<sqs-queue-url>
CHARACTER_WORKER_TOKEN=<worker-callback-token>
CHARACTER_LEASE_SECONDS=180
CHARACTER_MAX_ATTEMPTS=3
CHARACTER_JOB_TIMEOUT_SECONDS=3600
CHARACTER_QUEUE_LIMIT=20
CHARACTER_DISPATCH_SECONDS=30
AI_WORKER_URL=http://<school-windows-tailscale-ipv4>:8010
AI_WORKER_TOKEN=<ai-request-token>
QDRANT_URL=http://127.0.0.1:6333
QDRANT_COLLECTION=<restored-collection>
QDRANT_API_KEY=
```

- `AI_WORKER_URL`에는 **Windows Tailscale 숫자 IPv4** 사용. 아래 9-5절에서 WSL로 연결. 현재 코드에서 HTTP MagicDNS 이름은 허용되지 않음.
- S3와 큐는 이 문서에서 같은 리전 사용. 큐 URL과 ARN을 혼동하지 않음.
- `CORS_ORIGINS`는 실제 사용하는 웹 클라이언트 origin만 지정. 네이티브 앱만 테스트하면 빈 값 가능.
- 템플릿의 날씨·대기질·식물 외부 API 키도 기존 담당자와 대조.
- 실제 `apps/api/.env`를 서버끼리 통째로 복사하지 않음. systemd의 `EnvironmentFile` 값이 적용되며, 수동 터미널에는 자동 적용되지 않음.
- 학교의 SSH 중계 변수, 모델 경로, `CHARACTER_PUBLIC_BASE_URL`은 AWS API에 설정 불필요.
- DB 비밀번호의 특수문자는 URL 인코딩. 실제 비밀번호는 그대로 유지.

인코딩이 필요하면 비공개 터미널에서 실행. 출력도 비밀값으로 취급.

```bash
python3 -c 'from getpass import getpass; from urllib.parse import quote; print(quote(getpass("DB password: "), safe=""))'
```

### 8-2. API 서비스 설치

서비스 템플릿은 `User=leaflog`, 코드 `/srv/leaflog/app`, Python `/srv/leaflog/venv` 기준. 다른 경로면 설치 전에 수정.

```bash
if sudo test -e /etc/systemd/system/leaflog-api.service; then
  printf '기존 서비스 존재: 백업 및 비교 후 별도 적용\n'
else
  sudo install -m 0644 /srv/leaflog/app/ops/aws/leaflog-api.service \
    /etc/systemd/system/leaflog-api.service
fi
sudo systemd-analyze verify /etc/systemd/system/leaflog-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now leaflog-api
sudo systemctl status leaflog-api --no-pager
curl --fail --silent --show-error http://127.0.0.1:8000/health
```

기존 서비스가 있어 설치를 건너뛴 경우, 이어서 실행하기 전에 검수한 새 서비스 내용이 반영됐는지 확인. 새 환경에서는 `active (running)`, `{"status":"ok"}` 확인.

실패 시:

```bash
sudo journalctl -u leaflog-api -n 100 --no-pager
```

DB 스키마 오류는 5절, 자격증명 오류는 3-2·8-1절 확인. `--reload` 사용 안 함. 초기 API 프로세스는 1개.

### 8-3. HTTPS

도메인이 없는 테스트 환경은 [공인 IP 인증서 구성](../ops/aws/https/README.md)을 사용한다. 2026-09-10부터 준비하는 현재 EC2 테스트 환경은 Nginx·Certbot 방식이다. 아래 Caddy 절차는 도메인이 있는 신규 환경의 대안이며 현재 서버에 중복 설치하지 않는다. 두 방식 모두 인증서 발급·외부 접속·자동 갱신 검증이 완료돼야 한다.

위치: **AWS Ubuntu**. 준비: 테스트 도메인 DNS, EC2 80·443 접근.

```bash
sudoedit /etc/caddy/Caddyfile
```

기존 Caddyfile이 있으면 백업하고 기존 사이트는 유지. 새 테스트 사이트 블록 추가.

```caddyfile
api-test.example.com {
    request_body {
        max_size 16MB
    }
    reverse_proxy 127.0.0.1:8000
}
```

도메인을 실제 테스트 도메인으로 변경.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
read -rp '테스트 API URL, https:// 포함: ' TEST_API
curl --fail --silent --show-error "$TEST_API/health"
```

완료 기준: 외부 HTTPS 접속, 정상 인증서, health 200. 8000 포트는 인터넷 공개 안 함. Caddy 버전이 해당 지시어를 지원하지 않으면 검증 단계에서 중단. [요청 크기 제한](https://caddyserver.com/docs/caddyfile/directives/request_body)

현재 생성 업로드는 12MiB·2,400만 픽셀 이하 JPG/PNG/WebP 기준. 프록시 16MB는 multipart 전송 여유를 포함한 상한. 일반 기능의 업로드도 테스트.

`/internal/character-jobs/*`는 worker 토큰으로 인증. 별도의 접근 제한을 추가할 경우 학교의 실제 HTTPS 발신 경로를 확인하고 적용. 학교 callback까지 차단하면 생성 작업이 진행되지 않음.


## 9. 미나: 학교 AI worker 연결

준비: AWS API HTTPS 실행, 큐·토큰·학교 자격증명 확보. 팀원과 테스트 시간 합의. **학교 환경은 이 단계 전까지 변경하지 않음.**

### 9-1. 기존 환경 확인

위치: **학교 WSL Ubuntu의 leaflog 계정**.

```bash
whoami
uname -a
nvidia-smi
free -h
df -h "$HOME"
/usr/local/bin/leaflog-gpu status
systemctl list-units --type=service --all 'leaflog*' 'ollama*'
```

저장소에 기록된 기존 경로:

| 항목 | 기록된 경로·모델 |
|---|---|
| Forge | `/home/leaflog/stable-diffusion-webui-forge-recovered` |
| Forge Python | `/home/leaflog/miniforge3/envs/forge/bin/python` |
| 모델 루트 | `/home/leaflog/leaflog-ai-models` |
| GPU 전환 명령 | `/usr/local/bin/leaflog-gpu` |
| SDXL base | `Stable-diffusion/pixelArtDiffusionXL_spriteShaper.safetensors` |
| LoRA | `Lora/plantpet_sprite_lora_v2.safetensors` |
| VAE | `VAE/sdxl_vae.safetensors` |
| ControlNet | `ControlNet/diffusers_xl_canny_mid.safetensors` |
| Ollama 모델 | `qwen3.5:9b` |
| 전처리 누끼 | `birefnet-general` |
| 후처리 누끼 | `isnet-general-use` |
| CLIP | `openai/clip-vit-large-patch14` |

기록된 경로와 실제 파일을 대조. 다르면 실제 경로를 배포 기록에 남김. 이번 작업에서 Forge·GPU 드라이버·WSL 메모리 제한까지 함께 변경하지 않음.

기존 API의 서비스명, 실행 경로, 설정 파일, 정상 시작 명령을 비공개로 기록하고 백업. 테스트 중에는 **기존 API의 생성·상담 요청을 중지**해야 함. 새 worker의 잠금은 worker를 거치는 요청에만 적용. 수동 Forge 실행과 기존 Ollama 직접 호출은 잠금을 우회.

### 9-2. 별도 코드·Python 환경

위치: **학교 WSL Ubuntu의 leaflog 계정**. 기존 API·Forge 폴더를 덮지 않고 별도 설치.

```bash
git clone https://github.com/rosy-n/LeafLog-AI-Plant-Care.git "$HOME/leaflog-aws-worker"
read -rp 'API와 동일한 검수 커밋 SHA: ' DEPLOY_COMMIT
git -C "$HOME/leaflog-aws-worker" checkout --detach "$DEPLOY_COMMIT"
git -C "$HOME/leaflog-aws-worker" rev-parse HEAD
read -rp '학교에 설치된 conda 실행 파일 전체 경로: ' CONDA
"$CONDA" env list
```

`leaflog-aws-worker` 폴더나 아래 conda 환경이 이미 있으면 용도 확인 후 진행. 기존 환경 삭제·강제 재설치 금지.

```bash
"$CONDA" create -n leaflog-aws-worker python=3.12 -y
read -rp '생성한 환경의 bin/python 전체 경로: ' WORKER_PY
"$WORKER_PY" --version
cd "$HOME/leaflog-aws-worker/apps/api"
"$WORKER_PY" -m pip install -r requirements-worker.txt
"$WORKER_PY" -m pip check
```

기존 Miniforge 경로 기준 예: `/home/leaflog/miniforge3/envs/leaflog-aws-worker/bin/python`.
Python·의존성 설치가 실패하면 중단하고 오류 공유. Forge 전용 conda 환경은 수정하지 않음.

### 9-3. 모델 캐시 준비

팀원 GPU 작업과 겹치지 않는 시간에 실행. 누끼 모델과 CLIP은 첫 사용 시 다운로드될 수 있으므로 폰 테스트 전에 준비. 충분한 디스크·메모리와 외부 다운로드 연결 필요.

같은 WSL 계정으로 실행하면 기본 사용자 캐시를 재사용. 기존 서비스에서 `HF_HOME`, `U2NET_HOME`, `BACKGROUND_REMOVAL_MODEL`을 별도 지정했다면 먼저 대조. 다른 모델로 조용히 바꾸지 않음.

```bash
cd "$HOME/leaflog-aws-worker/apps/api"
APP_ROLE=worker "$WORKER_PY" -c 'from app.image_preprocessing import _background_removal_session as load, release_background_removal_sessions as release; load("birefnet-general"); release(); load("isnet-general-use"); release(); print("background models ready")'
APP_ROLE=worker "$WORKER_PY" -c 'from app.diagnosis import _clip; _clip(); _clip.cache_clear(); print("CLIP ready")'
```

위 코드는 캐시를 준비하고 종료. 지속 실행 서버가 아님. CLIP은 worker 역할에서 CPU 사용. 다운로드 완료만으로 실제 생성 품질까지 확인된 것은 아니므로 11절 테스트 필요.

### 9-4. worker 설정·자동 실행

학교 worker의 AWS 자격증명은 **leaflog 계정**에서 접근 가능한 위치에 준비. root 계정에만 등록하면 서비스에서 읽지 못함. `AWS_PROFILE=leaflog-school-worker`를 사용할 경우 해당 프로필을 준비하고 만료·갱신 담당자 지정.

테스트용 키를 승인받아 사용하는 경우, leaflog 계정의 비공개 프로필에 기록. 기존 다른 프로필은 유지.

```bash
install -d -m 0700 "$HOME/.aws"
if ! test -e "$HOME/.aws/credentials"; then
  install -m 0600 /dev/null "$HOME/.aws/credentials"
fi
chmod 0600 "$HOME/.aws/credentials"
nano "$HOME/.aws/credentials"
```

파일에 아래 프로필 추가. 실제 값은 키를 발급한 담당자에게 비공개로 수령. 임시 키면 세션 토큰도 필수.

```ini
[leaflog-school-worker]
aws_access_key_id = <school-worker-access-key>
aws_secret_access_key = <school-worker-secret-key>
# 임시 자격증명일 때만 다음 줄 추가
# aws_session_token = <session-token>
```

이 파일은 저장소 밖에 유지. SSO·credential_process 등 기존 인증 방식을 사용하는 경우 위 키 파일 방식으로 중복 설정하지 않음. 장기 키도 무기한 방치하지 않고 회전·폐기 담당 지정.

자격증명 확인:

```bash
AWS_PROFILE=leaflog-school-worker "$WORKER_PY" -c 'import boto3; print(boto3.client("sts").get_caller_identity()["Arn"])'
```

학교 전용 제한 권한 주체가 출력되어야 함. SSO 등 임시 프로필은 만료 뒤 무인 서비스가 중단될 수 있으므로 갱신 절차 없이 완료 처리하지 않음.

설정 파일 생성:

```bash
sudo install -d -m 0755 /etc/leaflog
if ! sudo test -e /etc/leaflog/worker.env; then
  sudo install -m 0600 -o root -g root \
    "$HOME/leaflog-aws-worker/ops/aws/worker/.env.example" /etc/leaflog/worker.env
fi
sudoedit /etc/leaflog/worker.env
```

큐·토큰·callback URL 입력. 이 문서는 **Windows Tailscale Serve → WSL localhost** 연결을 사용하므로 템플릿의 `AI_WORKER_HOST`도 아래처럼 변경.

```ini
APP_ROLE=worker
S3_REGION=ap-northeast-2
AWS_PROFILE=leaflog-school-worker
CHARACTER_QUEUE_URL=<same-sqs-queue-url>
CHARACTER_WORKER_API_URL=https://<api-test-domain>
CHARACTER_WORKER_TOKEN=<same-worker-callback-token>
AI_WORKER_TOKEN=<same-ai-request-token>
CHARACTER_LEASE_SECONDS=180
AI_WORKER_HOST=127.0.0.1
AI_WORKER_PORT=8010
AI_GPU_LOCK_PATH=/run/leaflog-ai/gpu.lock
CHARACTER_OUTPUT_DIR=/var/lib/leaflog-ai/characters
CHARACTER_GPU_MODE_COMMAND=/usr/local/bin/leaflog-gpu
CHARACTER_GPU_SSH_HOST=
CHARACTER_RESTORE_OLLAMA=true
CHARACTER_MOCK_GENERATION=false
FORGE_API_URL=http://127.0.0.1:7860
OLLAMA_API_URL=http://127.0.0.1:11434/api/chat
CHARACTER_CANVAS_SIZE=1024
CHARACTER_PREPROCESS_QUALITY=quality
CHARACTER_POSTPROCESS_QUALITY=fast
CHARACTER_INFERENCE_STEPS=20
CHARACTER_FORGE_STARTUP_TIMEOUT_SECONDS=180
CHARACTER_GENERATION_TIMEOUT_SECONDS=600
CHARACTER_GPU_SWITCH_TIMEOUT_SECONDS=240
```

worker에는 `DATABASE_URL` 불필요. 프로필 이외의 자격증명 방식을 채택했다면 `AWS_PROFILE`을 제거하고 해당 방식을 검증. 앱·API용 AWS 키를 재사용하지 않음.

서비스 템플릿 복사. 기존 동명 서비스가 있으면 덮어쓰지 말고 백업·비교.

```bash
if ! sudo test -e /etc/systemd/system/leaflog-ai-worker.service; then
  sudo install -m 0644 "$HOME/leaflog-aws-worker/ops/aws/leaflog-ai-worker.service" \
    /etc/systemd/system/leaflog-ai-worker.service
fi
sudoedit /etc/systemd/system/leaflog-ai-worker.service
```

다음 두 줄을 실제 설치 경로로 변경. 나머지 잠금·상태 디렉터리·종료 대기 설정은 유지.

```ini
WorkingDirectory=/home/leaflog/leaflog-aws-worker/apps/api
ExecStart=/home/leaflog/miniforge3/envs/leaflog-aws-worker/bin/python -m app.ai_worker
```

**기존 API의 AI 요청이 중지됐는지 확인 후** 새 worker 시작. `app.main:app`이나 `--workers 2`로 실행하지 않음.

```bash
sudo systemd-analyze verify /etc/systemd/system/leaflog-ai-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now leaflog-ai-worker
sudo systemctl status leaflog-ai-worker --no-pager
sudo journalctl -u leaflog-ai-worker -n 80 --no-pager
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:8010/health
curl --fail --silent --show-error http://127.0.0.1:11434/api/tags
```

인증 헤더 없는 worker health는 **401이 정상**. Ollama 모델 목록에서 `qwen3.5:9b` 확인. worker는 시작 시 Ollama 모드를 복구하므로 Forge가 꺼져 있는 것은 정상. 생성 요청이 오면 전환.

### 9-5. 학교 Windows에서 WSL 연결

담당: 미나. 위치: **학교 Windows PowerShell**. 기존 Windows Tailscale 로그인 유지. WSL에 Tailscale을 추가 설치하거나 Windows의 Tailscale을 끄지 않음.

**현재 테스트 환경에는 18010 → 8010 전달이 이미 적용되어 있음. 아래 Serve 절차는 다른 신규 환경을 위한 선택안이며 지금 학교에 중복 적용하지 않음.** 테스트 API의 `AI_WORKER_URL` 포트는 18010, WSL의 `AI_WORKER_PORT`는 8010. EC2 또는 학교의 Tailscale 주소가 달라지면 전용 전달·출발지 허용/차단 규칙·API 설정을 함께 검수. Windows localhost 8010 확인과 EC2의 인증된 18010 확인을 구분.

이 문서는 Windows의 localhost 전달을 먼저 확인하고 Tailscale Serve로 내부망에 연결하는 방식. WSL NAT IP를 고정값으로 저장하지 않음. Windows·WSL 양쪽 Tailscale 동시 운영은 별도 제약이 있으므로 기존 원격 접속 경로를 임의 변경하지 않음. [Tailscale WSL 안내](https://tailscale.com/docs/install/windows/wsl2)

```powershell
$Ts = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
& $Ts status
& $Ts ip -4
& $Ts serve status
curl.exe --silent --show-error --output NUL --write-out '%{http_code}' http://127.0.0.1:8010/health
```

마지막 결과가 **401이면 Windows → WSL 연결 성공**. 연결 실패라면 Serve부터 설정하지 말고 WSL 서비스와 localhost 전달 확인. `.wslconfig`에 localhost 전달을 비활성화한 설정이 있는지 확인하되, 원격 작업 중 `wsl --shutdown`을 임의 실행하지 않음. [Windows에서 WSL 서비스 접근](https://learn.microsoft.com/en-us/windows/wsl/networking)

기존 Serve 설정에 8010이 없는 것을 확인하고, Tailscale 접근 정책에서 **AWS API 장비 → 학교 장비 TCP 8010만 허용**하도록 설정. 기존 전체 허용 규칙이 있으면 제한 규칙을 추가하는 것만으로 차단되지 않으므로 실제 접근 범위 확인.

```powershell
& $Ts serve --bg --tcp=8010 tcp://127.0.0.1:8010
& $Ts serve status
```

`serve reset`은 다른 팀원의 설정도 지우므로 사용하지 않음. `funnel`은 인터넷 공개 기능이므로 사용하지 않음. `--bg` 설정은 Tailscale 재시작 후 유지되지만 WSL 서비스 기동까지 대신하지 않음. [Serve TCP 전달·재시작 동작](https://tailscale.com/docs/reference/tailscale-cli/serve)

### 9-6. AWS → 학교 인증 연결 확인

위치: **AWS Ubuntu**. EC2에도 같은 팀 Tailscale 연결 필요. 신규 설치는 아래 공식 설치 경로 사용.

```bash
curl -fsSL https://tailscale.com/install.sh -o /tmp/leaflog-tailscale-install.sh
less /tmp/leaflog-tailscale-install.sh
sudo sh /tmp/leaflog-tailscale-install.sh
sudo tailscale up
tailscale status
```

이미 설치·로그인된 서버라면 재설치하지 않음. 인증·장비 승인·접근 정책을 적용한 뒤 학교 장비가 보이는지 확인. [Linux 설치](https://tailscale.com/docs/install/linux)

8-1절 `AI_WORKER_URL`이 학교 **Windows Tailscale 숫자 IPv4**인지 확인. 다음은 API와 같은 계정·환경 파일로 health를 호출하는 일회성 검사. 토큰을 출력하지 않음.

```bash
sudo systemd-run --wait --pipe --collect \
  -p User=leaflog -p Group=leaflog \
  -p WorkingDirectory=/srv/leaflog/app/apps/api \
  -p EnvironmentFile=/etc/leaflog/api.env \
  /srv/leaflog/venv/bin/python -c 'import os,requests; r=requests.get(os.environ["AI_WORKER_URL"]+"/health",headers={"X-LeafLog-AI-Token":os.environ["AI_WORKER_TOKEN"]},timeout=15); print(r.status_code,r.json()); r.raise_for_status()'
```

연결 확인 기준: `200`, `status: ok`. `busy: true`는 다른 AI 작업 처리 중이라는 의미. 보강한 worker는 다음 큐 상태도 반환.

| `queue.status` | HTTP | 의미·조치 |
|---|---|---|
| `paused` | 200 | 생성 중지 상태. AWS 인증 없이 상담·임베딩 연결 검사 가능. 생성 준비 완료가 아님 |
| `starting` | 503 | 아직 첫 수신 성공 전. 시작 직후에는 긴 폴링 종료까지 기다린 뒤 재확인 |
| `ready` | 200 | 수신 성공, 현재 관측된 미복구 SQS 오류 없음 |
| `unavailable` | 503 | 인증·권한·연결 등 SQS 오류. `queue.error`의 오류 종류 확인 |
| `stopped` | 503 | 생성은 켜져 있으나 수신 스레드 종료. 서비스 로그 확인 |

- `NoCredentialsError`·`ProfileNotFound`: worker 실행 계정의 승인된 인증 설정 확인.
- `ExpiredToken`·`AccessDenied`: 인증 만료·권한 확인. 임의로 권한 확대하거나 다른 사람의 키로 대체하지 않음.
- 클라이언트 초기화·수신 실패는 10초 대기 후 다시 시도. 자격증명 발급·갱신 자체를 대신하지 않으며, 환경 파일 변경은 서비스 재시작이 필요할 수 있음.
- 메시지 삭제·가시성 연장에서 오류가 관측되면 단순 수신 성공으로 정상 처리하지 않음. 해당 동작 성공 후 오류 해제.
- `ready`는 아직 실행하지 않은 삭제·가시성 연장 권한, GPU·S3 업로드 성공까지 보장하지 않음. 실제 생성 1건으로 따로 검증.
- health 요청은 큐를 직접 수신하지 않음. 인증 토큰이 없으면 401. 오류 응답·로그에는 인증 원문이나 서명 URL을 남기지 않음.

학교에서 AWS HTTPS callback 접속도 확인.

```bash
read -rp 'AWS 테스트 API URL: ' TEST_API
curl --fail --silent --show-error "$TEST_API/health"
```

### 9-7. 자동 시작·복구 확인

- WSL: `systemctl is-enabled leaflog-ai-worker` 결과 `enabled`.
- Windows: 기존 WSL 유지 예약 작업과 Tailscale 무인 실행 상태 확인.
- 사용자 로그아웃 후에도 실행되는지 확인.
- Windows 재부팅 시험은 현장 복구 가능한 시간에만 진행. 재부팅 이후 Windows localhost 401, AWS 인증 health 200, 실제 AI 요청까지 확인.
- 기존 WSL 유지 작업이 있으면 중복 등록하지 않음. 작업명·실행 계정·배포판·실행 명령을 기록.
- 미설정 상태라면 담당자가 기존 `ops/school-gpu/install-wsl-keepalive.ps1`을 검토해 적용. Forge 재설치 스크립트를 함께 실행하지 않음.

정상 worker 종료는 진행 중인 생성과 Ollama 복구를 기다릴 수 있음. 종료 대기 중 반복 restart·강제 kill 금지. 서버가 강제 종료되면 다음 시작 시 기본 모드를 복구하고, 미완료 생성은 실행 임대 만료 후 재시도 대상이 됨.

## 10. 소윤·팀원: 모바일 실행

준비: 미나의 API·worker 연결 완료 통보, 지은의 데이터 검증 결과, 공통 SHA, 테스트 계정.

### 10-1. 별도 테스트 코드 준비

위치: **각 팀원 개발 PC**. GitHub Desktop 또는 Git에서 검수한 SHA 확인. 기존 미커밋 작업은 덮어쓰지 않음.

신규 폴더를 만드는 명령 예시:

```bash
git clone https://github.com/rosy-n/LeafLog-AI-Plant-Care.git LeafLog-AWS-Test
cd LeafLog-AWS-Test
git checkout --detach <reviewed-commit-sha>
git rev-parse HEAD
cd apps/mobile
node --version
npm ci
```

`<reviewed-commit-sha>`는 실제 SHA로 바꾼 후 실행. Node는 저장소 기준 22.13 이상, 프로젝트 SDK는 57. 설치된 Expo Go의 프로젝트 지원 버전 확인. 이 검증을 위해 SDK를 다시 변경하지 않음.

### 10-2. 모바일 환경 설정

`apps/mobile/.env.local`에 설정.

```ini
EXPO_PUBLIC_API_BASE_URL=https://<api-test-domain>
```

- `.env.example`: Git에 보관하는 설정 예시. 실제 접속 파일이 아님.
- `.env`, `.env.local`: 해당 PC의 실제 설정. Expo에서는 `.env.local`의 중복 키 우선.
- 기존 식물 식별용 `EXPO_PUBLIC_PLANTNET_API_KEY` 등 다른 기능의 설정을 통째로 삭제하지 않음. 새 체크아웃에는 기존 승인된 개발 설정도 필요.
- `EXPO_PUBLIC_*` 값은 앱 사용자에게 노출될 수 있음. 서버용 비밀키를 여기에 넣지 않음. 기존 PlantNet 키 관리 개선은 이번 이전과 별도 검토.
- API 주소 변경 후 Expo 재시작 필요.

```bash
npx expo start --clear
```

개인 PC에서는 `uvicorn`, Forge, 누끼 모델 실행 불필요. 휴대폰은 AWS 통신에 Tailscale 불필요. 단, Expo 개발 서버 연결은 별개이므로 기존 Wi-Fi·개발용 연결 방식 유지.

완료 기준: 공통 테스트 계정으로 로그인, 기존 식물 조회, AWS API 로그에 해당 요청 확인. 예전 학교 주소나 다른 DB에 연결된 상태를 테스트 완료로 기록하지 않음.

## 11. 공동: 통합 검증

### 11-1. 기능 테스트

| 순서 | 시험 | 통과 기준 |
|---|---|---|
| 1 | 기존 계정 로그인 | 복원한 계정·식물·기록 조회. JWT 변경 시 재로그인 |
| 2 | 기존 캐릭터 | 본체·얼굴·효과 표시, 저장한 선택값 유지 |
| 3 | 식물 등록 | 촬영 가이드 → 사진 입력 → 생성 중 종·특성 입력 → 후보 3개 → 선택·이름 입력 → 등록 |
| 4 | 등록 직후·재진입 | 동일 개체와 캐릭터 표시. 표정·효과가 본체 위에 정상 배치 |
| 5 | 이미지 주소 갱신 | 장시간 대기·앱 재활성화 후 캐릭터 표시 유지 |
| 6 | 상담·진단 | Ollama 응답, CLIP·Qdrant 검색, 진단 사진 저장·재조회 |
| 7 | 생성 중 상담 | 중복 모델 적재 없이 재시도 안내. 생성 종료 후 다시 요청하면 응답 |
| 8 | 다른 계정 | 다른 사용자 작업·이미지 갱신 요청 차단 |
| 9 | 두 계정 생성 | 각자의 후보를 조회하고 학교 GPU는 직렬 처리 |
| 10 | 사용자 사진 포맷 | 실제 아이폰 사진 입력·크기 조정·업로드 정상 |
| 11 | 속도·메모리 | 후보 3개 완료까지 측정, 학교 RAM·Commit·VRAM 기록 |
| 12 | 외부 기능 | 식물 검색·식별, 날씨·대기질·일지 등 기존 기능 유지 |

상담 요청은 생성 대기열에 자동 적재되지 않음. GPU 사용 중이면 재시도 안내 후 사용자가 다시 요청하는 방식. 생성 시간은 새 환경에서 측정하며 목표 시간을 보장값으로 기록하지 않음.

첫 모델 다운로드 시간과 캐시 준비 후 생성 시간을 분리해서 기록. `전처리 / Forge 준비 / 후보별 생성 / 후처리 / Ollama 복구 / 전체` 단계 로그 대조.

### 11-2. 장애·재시작 테스트

**테스트 DB·큐에서만**, 팀원과 시간을 정하고 실시.

| 시험 | 기대 결과 |
|---|---|
| 생성 중 API 재시작 | DB 작업 기록 유지, 같은 작업 ID로 조회 가능 |
| 생성 후 worker 정상 재시작 | 기본 Ollama 모드 복구, 다음 생성 수신 |
| 통제된 worker 장애 | 작업 임대 만료 후 재시도, 시도 횟수·최종 상태 기록 |
| 학교 연결 끊김 | 일반 데이터 기능 유지, AI는 안내·대기·최종 실패 처리 |
| S3 업로드 권한 오류 | 성공으로 표시하지 않음. 로그와 DB 실패 기록 확인 |
| 앱 화면 이탈·복귀 | 기존 등록 흐름 유지 여부 확인 |
| Windows 재부팅 | Tailscale·WSL·worker 기동 후 AI 재사용 가능 |

앱 프로세스를 완전히 종료했을 때 작성 중인 폼 자동 복원은 미구현. 서버 작업 기록 보존과 구분. 동일 사진 재요청은 진행 중인 작업을 재사용하고, `GET /api/character-generations/active`로 진행 작업 조회 가능.

### 11-3. 상태 확인

AWS API 로그:

```bash
sudo journalctl -u leaflog-api --since '15 minutes ago' --no-pager
```

학교 WSL 로그·자원:

```bash
sudo journalctl -u leaflog-ai-worker --since '15 minutes ago' --no-pager
sudo journalctl -u leaflog-forge --since '15 minutes ago' --no-pager
sudo journalctl -u ollama --since '15 minutes ago' --no-pager
nvidia-smi
free -h
df -h
```

Windows Commit은 학교 작업 관리자 → 성능 → 메모리 → 커밋됨에서 사용량/한도 확인. WSL의 `free -h`만으로 Windows Commit을 판단하지 않음.

복원 DB에서 읽기 전용 조회:

```sql
SELECT job_id, status, progress, attempts, current_candidate,
       created_at, updated_at, lease_until, plant_id
FROM character_job
ORDER BY created_at DESC
LIMIT 20;
```

`queued → preprocessing → starting_gpu → generating → postprocessing → completed` 흐름 확인. 후보별 생성·후처리 과정에서 단계가 반복될 수 있음. `failed`는 최종 실패. DB 상태를 수동으로 completed로 바꾸거나 큐 메시지를 임의 삭제하지 않음.

## 12. 오류별 확인 순서

| 증상 | 우선 확인 | 담당 |
|---|---|---|
| 새 코드 파일이 없음 | 검수 SHA·브랜치 확인. 현재 원격에는 검수 전 코드가 없을 수 있음 | 소윤 |
| 의존성 설치 실패 | Python 버전·운영체제·정확한 requirements·디스크 | 미나·소윤 |
| RDS 연결 시간 초과 | VPC·보안 그룹·엔드포인트·실행 위치 | 지은·미나 |
| RDS 인증서 오류 | CA 파일 경로·호스트명·TLS 옵션 | 지은 |
| character_job 없음·권한 오류 | 5절 SQL 적용 DB와 앱 접속 DB 일치, GRANT | 지은 |
| 기존 식물이 없음 | 초기화 여부보다 연결 DB·계정부터 확인. seed/초기화 실행 금지 | 지은·소윤 |
| 이미지 403 | bucket/key, API 역할 GetObject 권한, 서명 만료·서버 시간 | 지은·미나 |
| 이미지 404·본체 누락 | 원본 복사·계획 보고서·DB 파일 연결 확인 | 지은·소윤 |
| Windows localhost:8010 실패 | worker 실행·바인드 주소·WSL localhost 전달 | 미나 |
| localhost 401, AWS는 연결 실패 | Serve 8010 설정, Tailscale 로그인·접근 정책 | 미나 |
| AWS 인증 health 401 | AI_WORKER_TOKEN 불일치, 서비스 재시작 누락 | 미나 |
| Worker API returned 401 | CHARACTER_WORKER_TOKEN 불일치 | 미나 |
| Worker API returned 404 | callback 주소·검수 SHA·APP_ROLE=api 확인 | 미나·소윤 |
| queued가 계속 유지 | worker 로그, 큐 URL·리전, 학교 자격증명·만료·수신 권한 | 미나 |
| 시작 시 sudo·GPU 전환 실패 | 실제 GPU 명령·실행 계정·제한된 sudoers 규칙 | 미나 |
| Forge 준비 실패 | 기존 모델 4종, Forge 서비스·ControlNet 초기화·메모리 | 미나·소윤 |
| 테스트 PC에서 누끼 다운로드 | 모바일이 예전 로컬 API를 사용하는지 확인 | 소윤 |
| S3 이전 skipped 발생 | 원본 경로·접근 권한·지원 이미지·체크섬 | 지은·소윤 |
| 진단 참고 사진만 안 보임 | Qdrant payload의 옛 주소. media_asset 이전 대상과 구분 | 미나 |
| 상담이 재시도 안내 | 생성 종료 여부·busy 상태. 영구 오류면 Ollama 로그 | 미나·소윤 |
| 재부팅 뒤만 실패 | Windows 무인 Tailscale·WSL 유지 작업·worker enable | 미나 |

오류 공유 시 포함: 발생 시각, 실행 위치, 배포 SHA, 작업 ID, 재현 순서, HTTP 상태 또는 관련 로그 일부.
제외: 비밀번호, 전체 `.env`, 인증 토큰, 서명 URL, 사용자 원본 사진.

## 13. 최종 전환과 복구

### 13-1. 전환 조건

- [ ] 코드·문서 검수 완료 및 공통 SHA 확정
- [ ] RDS 복원·권한·건수 검증 완료
- [ ] 이미지 이전 누락 0, 기존 표정·효과 표시 확인
- [ ] Qdrant 건수·검색·참고 이미지 확인
- [ ] 생성 후보 3개·등록·재진입 확인
- [ ] 생성 종료 후 Ollama·진단 복구 확인
- [ ] 학교 자격증명 갱신·자동 시작·백업 담당 지정
- [ ] 장애·복구 시험 결과 확인
- [ ] 전환 시간·쓰기 중지 범위·복구 담당 합의

### 13-2. 전환 절차

1. 팀 승인 후 검수한 작업 브랜치를 `develop`에 반영. 병합 결과 SHA로 최종 검사.
2. 기존 API의 등록·수정·생성 요청 중지. 진행 중인 작업 정리.
3. 학교 DB·사진·변경된 Qdrant 최종 백업 및 건수·해시 기록.
4. **새 빈 운영 DB**에 복원. 테스트 DB를 운영 데이터 위에 덮어쓰지 않음.
5. 운영 DB에도 작업 테이블 SQL·앱 권한 적용. 최종 사진 이전은 운영 DB를 대상으로 새 계획 작성·검증.
6. 운영 큐·DLQ를 별도로 준비하고 API·worker의 큐·리전·callback 설정을 함께 변경. 테스트 큐에 남은 작업이 운영에서 실행되지 않게 분리.
7. API·worker를 같은 SHA로 배포. 생성 진행 중이면 worker 종료 완료를 기다린 뒤 변경.
8. 운영 API 주소로 로그인·기존 사진·새 생성 확인. 앱 API 주소 반영 후 쓰기 재개.
9. 기존 API가 옛 DB에 쓰거나 GPU를 직접 조작하는 경로 중지. 백업·복구 설정 유지.
10. API 오류, 큐 대기, 최종 실패, Windows Commit·VRAM, 디스크, AWS 비용 확인.

### 13-3. 복구 기준

| 상태 | 조치 |
|---|---|
| 테스트 중, AWS에 실제 운영 쓰기 전 | 테스트 요청 중지 → 새 worker 정상 종료 → 기존 API·Ollama 실행 → 앱 주소 복구 |
| AWS에 실제 사용자 쓰기 시작 후 | 양쪽 쓰기 중지 → 새 데이터·이미지 보존 → 차이 대조·역이전 계획 확정 → 복구 |
| GPU 작업이 멈춤 | 로그·메모리 확인 후 작업 종료 협의. Windows 강제 재부팅부터 시도하지 않음 |

학교 worker 정상 종료 명령:

```bash
sudo systemctl stop leaflog-ai-worker
sudo systemctl status leaflog-ai-worker --no-pager
```

종료 완료와 GPU 상태 확인 후 기존 서비스를 재개. 이전 서비스명·시작 명령은 9-1절에 확보한 기록 사용. GPU를 조작하는 실행 주체를 한쪽으로 제한.

### 13-4. 운영 전 남은 정책

현재 제한: 계정당 진행 중 생성 1개, 전체 대기 작업 20개, 최대 시도 3회, 전체 1시간. 일일 사용량·과금·공개 API 요청 제한 정책은 별도 확정 필요.

실패·미선택 생성 파일의 자동 정리와 계정 삭제 시 파일 보존 정책은 미완료. `leaflog/characters/` 전체에 만료 삭제 규칙을 적용하면 등록된 캐릭터도 삭제되므로 금지. DB 참조를 확인하는 정리 정책 필요.

## 14. 완료 기록

팀 비공개 운영 문서에 아래 항목 작성. `미확인`을 완료로 표시하지 않음.

| 항목 | 기록할 내용 |
|---|---|
| 코드 | API SHA / worker SHA / 모바일 SHA |
| 서버 | API HTTPS 주소 / 학교 AI 연결 방식 / 서비스명·실행 경로 |
| 데이터 | 원본 백업 시각 / 복원 DB명 / 건수 차이 / 이미지 누락 수 / Qdrant 건수 |
| 생성 | 첫 실행·캐시 준비 후 소요시간 / 최대 Commit·VRAM / 결과 확인 |
| 장애 대응 | 재시작 시험 결과 / 자격증명 갱신 담당 / 백업 위치 / 복구 담당 |
| 전환 승인 | 담당자별 확인 결과 / 남은 문제 / 전환 시간 |

추가 전달 대상은 실제 접속값·자격증명과 위 실행 결과. 설치·이전·테스트 절차는 이 문서 기준으로 진행.
