# LoRA v2 학습 재현

2026-07-08의 v1 학습은 [TRAINING_V1.md](TRAINING_V1.md)에 별도로 기록한다.

## 목표

SDXL 기반의 도트 화분 캐릭터를 생성하는 Standard LoRA를 학습했다. 트리거 단어는 `plantpet_sprite`이다.

## 데이터

- 이미지: PNG 303개
- 캡션: TXT 303개
- 폴더 규칙: `5_plantpet_sprite`
- 이미지당 반복 횟수: 5
- 정규화 이미지: 없음
- 별도 dataset config: 없음

GUI 설정의 `training_comment`에는 과거 값인 `72 images`가 남아 있다. 실제 v2 데이터와 LoRA 메타데이터 기준 수량은 303개이다.

학습 데이터는 Git에 올리지 않는다. 외부 백업의 `leaflog-training-data-v2.tar.gz`에 PNG 303개와 TXT 303개가 들어 있으며, 압축 목록과 SHA-256을 검증했다.

## 핵심 설정

| 항목 | 값 |
|---|---|
| 구조 | SDXL Standard LoRA (`networks.lora`) |
| rank / alpha | 64 / 64 |
| 해상도 | 1024 x 1024 |
| epoch | 6 |
| 실제 완료 step | 최종 LoRA 메타데이터 기준 2280 |
| TOML의 계산 step | 2273 |
| batch size | 4 |
| gradient accumulation | 1 |
| precision | BF16, FP16 저장 |
| optimizer | Adafactor |
| learning rate | 0.0001 |
| UNet learning rate | 0.0001 |
| text encoder learning rate | 0.00005 |
| scheduler | `constant_with_warmup` |
| loss | L2 |
| noise offset | 0.0357, Original |
| bucket | 활성화, no upscale, step 32, min 64, max 2048 |
| caption | `.txt`, shuffle 활성화, keep tokens 1 |
| cache latents | 메모리 및 디스크 캐시 활성화 |
| gradient checkpointing | 활성화 |
| xformers | 활성화 |
| 학습용 별도 VAE | 사용하지 않음 |
| 실제 seed | 최종 LoRA 메타데이터 기준 2628725409 |

전체 설정은 다음 파일이 기준이다.

- `configs/training/config_lora-20260709-083220.toml`
- `configs/training/plantpet_sprite_lora_v2_20260709-083220.json`
- `configs/training/prompt.txt`

TOML은 RunPod 절대 경로를 이식 가능한 상대 경로로 바꾼 사본이다. 다른 학습 파라미터는 원본 실행 설정을 유지한다.

## 결과물

| 파일 | epoch |
|---|---:|
| `plantpet_sprite_lora_v2-000001.safetensors` | 1 |
| `plantpet_sprite_lora_v2-000002.safetensors` | 2 |
| `plantpet_sprite_lora_v2-000003.safetensors` | 3 |
| `plantpet_sprite_lora_v2-000004.safetensors` | 4 |
| `plantpet_sprite_lora_v2-000005.safetensors` | 5 |
| `plantpet_sprite_lora_v2.safetensors` | 6, 최종 |

최종 파일이 항상 시각적으로 가장 좋은 epoch라는 보장은 없다. 재학습 전에 중간 LoRA를 같은 입력과 seed로 비교해 배포 후보를 다시 선정한다.

## 환경

- Kohya GUI: v25.2.1
- Kohya GUI commit: `4161d1d80ad554f7801c584632665d6825994062`
- sd-scripts commit: `3e6935a07edcb944407840ef74fcaf6fcad352f7`
- Python: 3.10.20
- PyTorch: 2.5.0+cu124
- CUDA runtime: 12.4
- cuDNN: 9.1.0
- GPU: NVIDIA H100 80GB HBM3

정확한 패키지는 `environment/kohya/pip-freeze.txt`를 확인한다.

## 재현 순서

1. Kohya GUI와 sd-scripts를 기록된 commit으로 checkout한다.
2. 외부 백업의 학습 데이터를 `data/5_plantpet_sprite`에 푼다.
3. Civitai에서 동일한 SDXL 모델 버전을 내려받고 SHA-256을 비교한다.
4. TOML의 상대 경로를 실제 환경에 맞춘다.
5. 기록된 Python, PyTorch, CUDA 환경을 구성한다.
6. TOML 설정으로 학습하고 결과 파일의 메타데이터와 SHA-256을 보존한다.

샘플 생성 주기와 `log_with`가 비활성화되어 학습 샘플 이미지와 TensorBoard/W&B 로그는 남아 있지 않다.
