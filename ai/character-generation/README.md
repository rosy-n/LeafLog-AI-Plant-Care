# Plant Character Generation

사용자의 식물 사진을 도트 화분 캐릭터로 변환하기 위한 SDXL 실험 기록이다. 2026-07-08의 v1과 2026-07-09의 v2 LoRA, 2026-07-23에 보존한 RunPod 환경을 기준으로 한다.

현재 상태는 재현 가능한 연구 스냅샷이다. 모바일 앱에서 직접 실행하는 코드나 운영용 GPU 추론 서비스는 아직 포함하지 않는다.

## 구성

- SDXL 체크포인트: Pixel Art Diffusion XL, `Sprite Shaper`
- 자체 LoRA: `plantpet_sprite_lora` v1, `plantpet_sprite_lora_v2` v2
- 추론 VAE: `sdxl_vae.safetensors`
- 구조 제어: SDXL ControlNet Canny
- 학습 도구: Kohya GUI + sd-scripts
- 추론 도구: Stable Diffusion WebUI Forge

## 문서

- [v2 학습 재현](TRAINING.md)
- [v1 학습 기록](TRAINING_V1.md)
- [추론 재현](INFERENCE.md)
- [모델과 백업 파일](ARTIFACTS.md)
- [RunPod 인계 기록](RUNPOD_HANDOFF.md)
- [작업 이력](WORK_LOG.md)
- [환경 스냅샷](environment/README.md)

## 저장소 정책

Git에는 설정, 프롬프트, 환경 정보, 체크섬만 저장한다. 다음 자료는 외부 백업으로 관리한다.

- SDXL, LoRA, VAE, ControlNet 모델 파일
- 학습 이미지와 캡션
- 입력 및 생성 결과 이미지
- RunPod 전체 다운로드 ZIP

모델 파일과 학습 데이터는 `.gitignore`로 차단한다. 공개 배포 전에는 [ARTIFACTS.md](ARTIFACTS.md)의 라이선스 주의사항을 확인해야 한다.

## 디렉터리

```text
configs/
  training/       v2 Kohya 학습 설정과 프롬프트
    v1/           v1 최종 실행 설정과 프롬프트
  inference/      Forge 마지막 설정과 API payload 예제
environment/
  kohya/          학습 환경 버전과 패키지
  forge/          추론 환경 버전과 패키지
artifacts/
  manifest.json   외부 파일명, 크기, SHA-256
```
