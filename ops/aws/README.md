# AWS 배포 파일

실행 절차는 [AWS 이전 작업 가이드](../../docs/aws-team-handoff.md)에 통합.
담당 업무, AWS 준비, 백업·복원, 환경 설정, 학교 연결, 폰 테스트, 오류 대응, 전환·복구 순서까지 해당 문서 기준으로 진행.

현재 상태: 로컬 구현·모의 테스트 및 코드·문서 검수 완료. 원격 공유·실제 AWS·학교 배포 대기. 검수 완료 SHA 공유 전에는 원격 브랜치를 배포하지 않음.

## 파일 구성

| 파일 | 용도 |
|---|---|
| [api/.env.example](api/.env.example) | AWS API 설정 템플릿 |
| [worker/.env.example](worker/.env.example) | 학교 AI worker 설정 템플릿 |
| [leaflog-api.service](leaflog-api.service) | AWS API 자동 실행 |
| [leaflog-ai-worker.service](leaflog-ai-worker.service) | 학교 worker 자동 실행 |
| [작업 테이블 SQL](../../apps/api/migrations/20260907_character_jobs.sql) | 복원한 RDS에 character_job 추가 |
| [이미지 이전 도구](../../apps/api/scripts/migrate_media.py) | 계획 → 업로드 → 검증 → DB 반영 |

## 적용 기준

- 실제 주소·비밀번호·토큰은 비공개 환경 파일에만 기록.
- 서비스 템플릿의 실행 계정·코드·Python 경로는 설치 환경에 맞게 변경.
- 새 가이드의 Windows Tailscale Serve 연결은 worker를 WSL 루프백에 바인드. worker 템플릿의 `AI_WORKER_HOST`를 `127.0.0.1`로 변경.
- 별도 내부 인터페이스에 직접 연결하는 환경은 네트워크 담당자가 주소·바인드·방화벽을 함께 검증.
- 기존 `APP_ROLE=standalone` 설정과 새 API·worker 설정을 혼합하지 않음.
- 기존 학교 DB에는 새 SQL을 적용하지 않음. 새 테스트 RDS에서 먼저 검증.
- 통합 테스트 통과와 팀 승인 후 develop 병합·운영 전환.
