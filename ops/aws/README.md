# AWS 배포 파일

실행 절차는 [AWS 이전 작업 가이드](../../docs/aws-team-handoff.md)에 통합.
담당 업무, AWS 준비, 백업·복원, 환경 설정, 학교 연결, 폰 테스트, 오류 대응, 전환·복구 순서까지 해당 문서 기준으로 진행.

작업 브랜치: `feature/aws-migration`. develop `3245298` 변경과 생성 중지·오류 처리 보강을 이 브랜치에 반영. 인증 발급 전까지 검증한 작업의 보관 단계이며 서버 자동 배포나 이전 완료를 뜻하지 않음. EC2 내부 API, S3·SQS 발신 검사, Qdrant 191건 대조, 이미지 19건 이전, 테스트 RDS 스키마 보완 완료. 9월 8일 학교 테스트 worker와 Ollama 응답 확인. 9월 10일 HTTPS 외부 접속·접근 보호·자동 갱신 모의 실행 통과. 외부 API 키 3종은 비공개 설정에 반영. 9월 10일 재점검에서 학교 worker 연결 시간 초과. 학교 재연결·SQS 인증·실제 생성·휴대폰 검증이 남음. 최종 배포 SHA는 별도 확정.

추가 보강은 로컬 검사 완료·서버 미배포: 메시지 전달 지연 0초 명시, 학교 SQS 인증 오류 재시도, 수신·삭제·가시성 연장 상태 점검. 백엔드 143개·모바일 53개 테스트와 타입 검사 통과. 자세한 상태 구분은 작업 가이드 9-6절 참고.

IAM·SQS 준비 전 테스트는 API와 worker의 `CHARACTER_GENERATION_ENABLED=false`로 진행. 새 생성 요청과 큐 소비만 중지하며 로그인·기존 기록·상담·진단은 각 서비스의 연결 상태에 따라 검증 가능. 필요한 설정과 재개 순서는 가이드의 **0-1절** 참고.

학교 CLIP 캐시 준비 및 합성 이미지로 EC2 → 학교 임베딩 → EC2 Qdrant 검색 확인 완료. 이 연결 검사와 실제 식물 진단 정확도·모바일 화면 검증은 구분.

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
| [학교 SQS 정책 예시](iam/school-worker-policy.example.json) | 처리 큐 하나의 수신·삭제·가시성 갱신 권한. 인증 수단은 별도 발급 필요 |
| [도메인 없는 HTTPS](https/README.md) | 기존 공인 IP의 무료 인증서, Nginx 설정, 4시간 갱신 점검. Caddy와 선택 적용 |
| [테스트 RDS 스키마 보완](../../apps/api/migrations/20260908_rehearsal_develop_schema.sql) | 종 사진 테이블·앱 권한·BATHROOM 위치. 백업·승인 후 테스트 RDS 적용 완료. 운영 DB는 별도 검수 |

## 적용 기준

- 실제 주소·비밀번호·토큰은 비공개 환경 파일에만 기록.
- 서비스 템플릿의 실행 계정·코드·Python 경로는 설치 환경에 맞게 변경.
- worker 템플릿의 `AI_WORKER_HOST=127.0.0.1`은 WSL 루프백 연결 기준. 현재 학교 테스트는 Windows Tailscale 전용 18010 → localhost 8010 전달과 EC2 출발지 제한 사용. Serve 중복 설정 금지.
- 테스트 worker는 생성 중지·자동시작 비활성. 최종 전환 시 기존 학교 GPU 작업과의 중복 방지, 자동시작·복구 검증 필요.
- 별도 내부 인터페이스에 직접 연결하는 환경은 네트워크 담당자가 주소·바인드·방화벽을 함께 검증.
- 기존 `APP_ROLE=standalone` 설정과 새 API·worker 설정을 혼합하지 않음.
- 기존 학교 DB에는 새 SQL을 적용하지 않음. 새 테스트 RDS에서 먼저 검증.
- 통합 테스트 통과와 팀 승인 후 develop 병합·운영 전환.
