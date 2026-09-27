# AWS 배포 파일

실행 절차는 [AWS 이전 작업 가이드](../../docs/aws-team-handoff.md)에 통합.
담당 업무, AWS 준비, 백업·복원, 환경 설정, 학교 연결, 폰 테스트, 오류 대응, 전환·복구 순서까지 해당 문서 기준으로 진행.

2026-09-11 AWS 운영 전환 완료. 9월 12일 점검 기준 API·학교 worker 실행 코드는 develop `855f53f`이며, 이후 문서·주석 정리는 실행 코드 변경과 구분한다. 최신 운영 현황은 작업 가이드 **0절**을 기준으로 확인한다.

9월 12일 읽기 전용 점검: AWS HTTPS API 정상, RDS 운영 DB `leaflog` 연결 정상, Qdrant 191건 정상. 학교 worker는 IAM Roles Anywhere로 SQS를 수신하며 상태는 `ready`. API와 worker 모두 생성 활성화·자동시작 상태다. 이전 학교 API는 중지·자동시작 해제되어 있다.

템플릿의 `CHARACTER_GENERATION_ENABLED=false`는 **새 환경 설치 중** 검증 전 큐 소비를 막는 기본값이다. 현재 운영 설정이 false라는 뜻은 아니다. 작업 가이드 0-1절의 권한 승인 전 절차는 과거 준비 기록이며 운영 환경에 그대로 재적용하지 않는다.

학교 인증서는 2026-12-31 만료 예정. 12월 초 갱신 절차를 협의한다. EC2 재부팅 복구는 확인했고, 학교 Windows 재부팅 복구는 현장 시험이 남아 있다. 신규 코드의 로컬 테스트 통과와 운영 배포·휴대폰 검증은 별도로 기록한다.

## 파일 구성

| 파일 | 용도 |
|---|---|
| [api/.env.example](api/.env.example) | AWS API 설정 템플릿 |
| [worker/.env.example](worker/.env.example) | 학교 AI worker 설정 템플릿 |
| [leaflog-api.service](leaflog-api.service) | AWS API 자동 실행 |
| [leaflog-ai-worker.service](leaflog-ai-worker.service) | 학교 worker 자동 실행 |
| [작업 테이블 SQL](../../apps/api/migrations/20260907_character_jobs.sql) | 복원한 RDS에 character_job 추가 |
| [이미지 이전 도구](../../apps/api/scripts/migrate_media.py) | 계획 → 업로드 → 검증 → DB 반영 |
| [EC2 접근 점검](../../apps/api/scripts/check_aws_access.py) | 역할 선택 확인. 명시적 옵션으로만 S3·SQS 테스트 쓰기 |
| [학교 SQS 정책 예시](iam/school-worker-policy.example.json) | 처리 큐 하나의 수신·삭제·가시성 갱신 권한. 운영 인증은 IAM Roles Anywhere 사용 |
| [도메인 없는 HTTPS](https/README.md) | 기존 공인 IP의 무료 인증서, Nginx 설정, 4시간 갱신 점검. Caddy와 선택 적용 |
| [테스트 RDS 스키마 보완](../../apps/api/migrations/20260908_rehearsal_develop_schema.sql) | 이전 당시 스키마 보완 기록. 운영 DB에 재실행하지 않음 |

## 적용 기준

- 실제 주소·비밀번호·토큰은 비공개 환경 파일에만 기록.
- 서비스 템플릿의 실행 계정·코드·Python 경로는 설치 환경에 맞게 변경.
- worker 템플릿의 `AI_WORKER_HOST=127.0.0.1`은 WSL 루프백 연결 기준. 학교 운영 환경은 Windows Tailscale 전용 18010 → localhost 8010 전달과 EC2 출발지 제한 사용. Serve 중복 설정 금지.
- 현재 `leaflog-ai-worker`는 자동시작 활성화 상태. 기존 학교 `leaflog-api`를 다시 켜지 않음.
- 별도 내부 인터페이스에 직접 연결하는 환경은 네트워크 담당자가 주소·바인드·방화벽을 함께 검증.
- 기존 `APP_ROLE=standalone` 설정과 새 API·worker 설정을 혼합하지 않음.
- 기존 학교 DB에는 새 SQL을 적용하지 않음. 새 테스트 RDS에서 먼저 검증.
- 기능 브랜치에서 검증하고 팀 승인 후 develop 병합·배포. GitHub 병합만으로 서버 코드가 자동 교체되지는 않음.
