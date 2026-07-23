# SDXL img2img + ControlNet Canny 추론

## 모델 조합

- 체크포인트: `pixelArtDiffusionXL_spriteShaper.safetensors`
- LoRA: `plantpet_sprite_lora_v2.safetensors`, weight 1.0
- VAE: `sdxl_vae.safetensors`
- ControlNet: `diffusers_xl_canny_mid.safetensors`
- 전처리기: `canny`
- Clip skip: 2

학습에서는 별도 VAE를 사용하지 않았지만 Forge 추론에서는 VAE를 명시적으로 선택했다.

## 마지막으로 기록된 프롬프트

Positive:

```text
<lora:plantpet_sprite_lora_v2:1.0>, plantpet_sprite, (long vertical rectangular pixel eyes:2.0), blush stickers, closed mouth, big face, potted plant, cute potted plant character, pixel art sprite, simple clean outline, front view, centered, white background, Pixel art style, bold outlines, White background, a simple and symmetrical plant sprite, clean leaf arrangement, minimal leaf count, bold dark outline, simple iconic silhouette, minimal shading, retro game sprite, (flat:2.0), transparent background, looking at viewer, plant, leaf
```

Negative:

```text
photorealistic, realistic, 3d render, messy background, text, watermark, blurry, extra limbs, bad quality, background, stripe, high resolution, colorful outline, small detail, small dot, no face
```

## img2img 설정

| 항목 | 값 |
|---|---|
| sampler | DPM++ 2M Karras |
| steps | 25 |
| CFG scale | 7 |
| denoising strength | 0.8 |
| 출력 크기 | 1024 x 1024 |
| 기록된 seed | 3020141020 |
| Clip skip | 2 |

## ControlNet 설정

| 항목 | 값 |
|---|---|
| module | `canny` |
| weight | 0.45 |
| guidance start / end | 0 / 0.5 |
| Canny low / high | 100 / 200 |
| processor resolution | 512 |
| resize mode | Crop and Resize |
| pixel perfect | false |
| control mode | Balanced |
| HR option | Both |

Forge API payload 예제는 `configs/inference/img2img-controlnet-payload.example.json`에 있다. `BASE64_IMG2IMG_INPUT_TODO`와 `BASE64_CONTROLNET_INPUT_TODO`를 실제 base64 이미지로 교체해야 한다.

## Forge 환경

- 저장소: `https://github.com/lllyasviel/stable-diffusion-webui-forge.git`
- commit: `bfee03d8d9415a925616f40ede030fe7a51cbcfd`
- 버전: `f0.0.17v1.8.0rc-latest-278-gbfee03d8`
- 내장 ControlNet API version: 2
- Python: 3.10.20
- PyTorch: 2.1.2+cu121
- CUDA runtime: 12.1
- cuDNN: 8.9.2

당시 Forge working tree에서는 Marigold 전처리기 파일이 비활성화되어 있었다. Canny 실행과 직접 관련되지는 않지만 정확한 상태는 `environment/forge/git-status.txt`와 `working-tree.patch`에 기록했다.

## 확인되지 않은 값

- 실제 img2img 입력 이미지
- img2img와 ControlNet에 같은 입력을 사용했는지 여부
- img2img 상위 `resize_mode`
- `batch_size`와 `n_iter`
- 당시 Forge 실행 명령과 `--api` 활성화 여부
- 특정 출력 PNG와 `params.txt`의 일대일 대응

보존된 출력 PNG에는 생성 파라미터 metadata가 없다. `params.txt`는 Forge의 마지막 설정이지만 특정 결과 이미지와 동일하다고 단정할 수 없다.

## 서비스화 시 주의

모델은 모바일이나 일반 FastAPI 서버 프로세스에 포함하지 않는다. GPU 추론 worker를 별도 서비스로 두고 앱 백엔드는 업로드, 작업 상태, 결과 저장을 조정하는 구조가 적절하다.

Forge API를 사용할 경우 `--api`를 활성화하되 외부에 인증 없이 직접 노출하지 않는다. 배경 분리 전처리와 투명 PNG 후처리는 별도 브랜치 `codex/plant-image-preprocessing`에서 관리 중이며 이 브랜치에는 포함되지 않는다.
