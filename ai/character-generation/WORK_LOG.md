# 작업 이력

## 2026-07-08

- `plantpet_sprite_lora` v1 학습
- epoch별 체크포인트와 최종 LoRA 생성
- 이후 v2 학습으로 대체

## 2026-07-09

- PNG 303개와 TXT 캡션 303개로 v2 학습
- 이미지당 5회 반복
- epoch 1-5 중간 LoRA와 epoch 6 최종 LoRA 저장
- `plantpet_sprite_lora_v2.safetensors`를 Forge에 배치

## Forge 추론 실험

- Pixel Art Diffusion XL `Sprite Shaper` 체크포인트 사용
- LoRA weight 1.0 적용
- 별도 SDXL VAE 선택
- img2img에 ControlNet Canny 적용
- 마지막 설정은 `configs/inference/params.txt`에 기록
- 결과 PNG에는 생성 metadata가 없어 특정 결과와 마지막 설정의 대응은 확인하지 못함

## 2026-07-23

- RunPod의 LoRA, 모델, 데이터, 설정, 환경을 읽기 전용으로 조사
- 모델 중복본을 제외하고 원본 경로 식별
- 학습 데이터 303쌍을 tar.gz로 보존
- 출력 PNG 47개 중 중복 2개를 식별하고 고유 45개 보존
- LoRA 6개, VAE, ControlNet, 데이터 및 예시를 로컬로 다운로드
- RunPod와 로컬에서 SHA-256 검증 완료
- SDXL 베이스는 Civitai 재다운로드 방식으로 전환
- GitHub용 설정, 환경 기록, 재현 문서를 분리
- 자동 생성 한국어 문서의 mojibake를 발견해 검증된 정보로 다시 작성
