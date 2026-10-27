# AWS 배포 파일

AWS API와 별도 GPU worker를 구성하는 환경 설정·서비스·권한 템플릿이다.
실제 주소, 인증 값, 데이터베이스와 저장소는 설치 환경에 맞게 별도로 준비한다.

새 환경 검증이 끝나기 전에는 `CHARACTER_GENERATION_ENABLED=false`를 유지한다.
API·worker 역할 설정을 구분하고, SQL 적용 전 대상 데이터베이스와 백업을 확인한다.
기본 소스 실행 및 외부 서비스 요건은 [프로젝트 안내](../../README.md)를 참고한다.

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
