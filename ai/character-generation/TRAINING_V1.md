# LoRA v1 학습 기록

## 개요

`plantpet_sprite_lora` v1은 2026-07-08에 Pixel Art Diffusion XL `Sprite Shaper`를 베이스로 학습했다. v2 이전의 비교용 실험 결과이며 트리거 단어는 `plantpet_sprite`이다.

## 데이터

- 이미지와 캡션: 각 72개
- 폴더 규칙: `10_plantpet_sprite`
- 이미지당 반복 횟수: 10
- 메타데이터의 총 학습 이미지 수: 720
- 정규화 이미지: 없음

v1 학습 데이터는 이번 RunPod 회수 대상에 포함되지 않았다. 같은 학습을 다시 실행하려면 기존 72쌍 데이터가 별도로 필요하다.

## 핵심 설정

| 항목 | 값 |
|---|---|
| 구조 | SDXL Standard LoRA (`networks.lora`) |
| rank / alpha | 64 / 64 |
| 베이스 모델 | `pixelArtDiffusionXL_spriteShaper.safetensors` |
| 베이스 SHA-256 | `7adffa28d4003a773c2d4e5f10ae1ba63c33573967864a7f9a4a3be9c9f04a93` |
| 해상도 | 1024 x 1024 |
| epoch | 6 |
| 실제 완료 step | 최종 LoRA 메타데이터 기준 1092 |
| TOML의 계산 step | 1080 |
| batch size | 4 |
| precision / 저장 | BF16 / BF16 |
| optimizer | Adafactor |
| learning rate | 0.0001 |
| text encoder learning rate | 0.00005 |
| scheduler | `constant_with_warmup` |
| seed | `1426784256` |
| sd-scripts commit | `3e6935a07edcb944407840ef74fcaf6fcad352f7` |

Git에 보존하는 설정은 다음과 같다.

- `configs/training/v1/config_lora-20260708-092836.toml`
- `configs/training/v1/plantpet_sprite_lora_20260708-092836.json`
- `configs/training/v1/prompt.txt`

RunPod에 있던 TOML 3개는 SHA-256이 모두 같고, GUI JSON 3개도 SHA-256이 모두 같았다. 중복을 줄이기 위해 마지막 시각인 `092836` 사본만 Git에 보존한다. TOML의 절대 경로는 이식 가능한 상대 경로로 바꿨으며 GUI JSON은 원본 실행 기록을 유지한다.

`sdxl-pony-v2.json`은 실행 결과가 아닌 별도 프리셋이므로 Git용 v1 설정에서 제외했다. 원본 ZIP과 로컬 원본 폴더에는 그대로 남아 있다.

## 결과물

| 파일 | epoch | SHA-256 | 보관 위치 |
|---|---:|---|---|
| `plantpet_sprite_lora-000001.safetensors` | 1 | `7573fee3fec9c86eee3d342baa6c0b4070ea2aa4a2dd020134cad23545592332` | 로컬 전용 |
| `plantpet_sprite_lora-000002.safetensors` | 2 | `af559511fc0181a792e4929b77767da60ea007cbf57c81d2ad2601951b24c813` | 로컬 전용 |
| `plantpet_sprite_lora-000003.safetensors` | 3 | `0bf5c8f4d022fe929a00bdefad9711ce5b36ee825199da62df4dc3bfcf248bf4` | 로컬 전용 |
| `plantpet_sprite_lora-000004.safetensors` | 4 | `adfc051c803e34f42681b199f8abe6ef5287df1f6c7511dee1c3b7784b85a253` | 로컬 전용 |
| `plantpet_sprite_lora-000005.safetensors` | 5 | `d4831477d2868e8a92607abbd2905d960735fb045683374bf36aff0591839e16` | 로컬 전용 |
| `plantpet_sprite_lora.safetensors` | 6, 최종 | `3f9a9525a5f7534b9fd9a5f852628ab665566f3316695e48ac8565713264746e` | GitHub Release + 로컬 |

각 LoRA의 크기는 456,488,788 bytes이다. GitHub Release에는 최종 파일 하나만 올리고 중간 체크포인트는 로컬에만 둔다.

## 로컬 보관

Git에서 제외되는 로컬 원본은 다음 경로에 있다.

```text
ai/character-generation/local-artifacts/plantpet-lora-v1/
  output.zip
  raw-output/
```

`raw-output/`에는 LoRA 6개와 RunPod에서 받은 설정 원본 전체가 있다. 이 폴더는 `.gitignore`로 차단한다.
