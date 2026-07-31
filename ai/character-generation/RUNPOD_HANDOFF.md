# RunPod 인계 기록

## 보존 완료

2026-07-23에 RunPod의 학습 및 추론 환경을 조사하고 다음 자료를 외부 백업으로 옮겼다.

- 최종 및 epoch 1-5 LoRA
- 추론 VAE
- SDXL ControlNet Canny
- 학습 이미지 303개와 캡션 303개
- 입력 이미지 후보와 중복 제거된 출력 PNG 45개
- Kohya와 Forge 설정, commit, 패키지 환경
- 학습 및 추론 파라미터
- 전체 SHA-256 목록

RunPod 원본과 로컬 다운로드에서 체크섬 검증을 각각 수행했으며 모두 통과했다.

## Git에 포함한 것

- 이 디렉터리의 재현 문서
- 학습 TOML과 Kohya GUI JSON
- Forge 마지막 설정과 API payload 예제
- Kohya와 Forge commit, runtime, pip freeze
- 모델과 데이터 파일의 크기 및 SHA-256

## Git에 포함하지 않은 것

- `.safetensors`, `.ckpt`, `.pt`, `.pth`
- 학습 데이터와 이미지
- 입력 및 출력 이미지
- ZIP 및 tar.gz 백업
- API key, token, 로그인 정보, shell history

## 복구 순서

1. 외부 백업의 체크섬 파일로 모델과 데이터 무결성을 확인한다.
2. SDXL 베이스의 정확한 Civitai 버전을 다시 내려받는다.
3. `ARTIFACTS.md`의 SHA-256과 비교한다.
4. `TRAINING.md` 또는 `INFERENCE.md`의 commit과 패키지 환경을 구성한다.
5. 설정 파일의 상대 경로를 실제 환경에 맞춘다.
6. 같은 seed와 입력으로 중간 LoRA를 비교한다.
7. GPU 추론 서비스를 앱 백엔드와 분리해 배포한다.

## 남은 확인

- 실제 img2img 및 ControlNet 입력 이미지
- 특정 출력과 `params.txt` 설정의 대응
- 최종 배포에 사용할 LoRA epoch
- 베이스 모델과 자체 LoRA의 공개 배포 권한
- 학습 데이터의 외부 공유 권한
- 운영 GPU, 저장소, 배포 방식
