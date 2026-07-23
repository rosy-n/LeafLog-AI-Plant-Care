# 모델과 백업 파일

## 핵심 아티팩트

모든 해시는 SHA-256이다. 모델 파일과 학습 데이터는 Git에 포함하지 않는다.

| 파일 | 역할 | 크기(bytes) | SHA-256 |
|---|---|---:|---|
| `pixelArtDiffusionXL_spriteShaper.safetensors` | SDXL 베이스 | 6,938,040,682 | `7adffa28d4003a773c2d4e5f10ae1ba63c33573967864a7f9a4a3be9c9f04a93` |
| `plantpet_sprite_lora_v2.safetensors` | 최종 LoRA, epoch 6 | 456,486,332 | `164cd7f903087116cc976ed22cc97e81dc5da3cb270fd3d09b34422f106f2ac0` |
| `plantpet_sprite_lora_v2-000001.safetensors` | LoRA, epoch 1 | 456,486,332 | `a68f04a9d15b56cf85d03683c855f5637d850413f25ee7efe0de7cd0b0e45106` |
| `plantpet_sprite_lora_v2-000002.safetensors` | LoRA, epoch 2 | 456,486,332 | `9ae9fc35b491e8a17397864317364919a0fd57979ebf4d6a041fea95b72d41d4` |
| `plantpet_sprite_lora_v2-000003.safetensors` | LoRA, epoch 3 | 456,486,332 | `7f11dce92af4ba0b1347bca84535ade559715d5f3a8c631bb881e9ba8e37fd5d` |
| `plantpet_sprite_lora_v2-000004.safetensors` | LoRA, epoch 4 | 456,486,332 | `27d6d596e1c5e2e05d9b38bf745bebc675b4ad6635ed89f41ea10a9f79e34e4d` |
| `plantpet_sprite_lora_v2-000005.safetensors` | LoRA, epoch 5 | 456,486,332 | `3d73b26c9759e6537ca562fe908f72474dd0cb547ab048d34d96a9f275ce8945` |
| `sdxl_vae.safetensors` | SDXL 추론 VAE | 334,641,164 | `63aeecb90ff7bc1c115395962d3e803571385b61938377bc7089b36e81e92e2e` |
| `diffusers_xl_canny_mid.safetensors` | SDXL ControlNet Canny | 545,197,704 | `a9440e186177ddaf4e6d4ef606a8bc8a7d77b3e895c322e19b663a61e0d46447` |
| `leaflog-training-data-v2.tar.gz` | PNG 303개 + TXT 303개 | 274,195,865 | `43fd80026e45dc4a75c6295805545e88558bb954d4ee8a411c61a428930121fc` |

기계가 읽을 수 있는 동일 정보는 `artifacts/manifest.json`에 있다.

## 공개 출처

### SDXL 베이스

- 모델: Pixel Art Diffusion XL
- 버전: Sprite Shaper
- Civitai model ID: `277680`
- Civitai version ID: `364043`
- 페이지: `https://civitai.com/models/277680?modelVersionId=364043`
- 다운로드: `https://civitai.com/api/download/models/364043`

### VAE

- 모델: SDXL VAE
- 버전: SDXL-VAE
- Civitai model ID: `296576`
- Civitai version ID: `333245`
- 페이지: `https://civitai.com/models/296576?modelVersionId=333245`
- 다운로드: `https://civitai.com/api/download/models/333245`

다운로드 파일명은 `sdxlVAE_sdxlVAE.safetensors`지만 로컬에서 `sdxl_vae.safetensors`로 사용했다. 파일명보다 SHA-256을 기준으로 확인한다.

### ControlNet

- 저장소: `https://huggingface.co/lllyasviel/sd_control_collection`
- 파일: `diffusers_xl_canny_mid.safetensors`
- 파일 페이지: `https://huggingface.co/lllyasviel/sd_control_collection/blob/main/diffusers_xl_canny_mid.safetensors`
- 라이선스 확인 기준: 원 저장소의 모델 카드와 연결된 SDXL ControlNet 라이선스

## 라이선스 주의

- Civitai 모델 페이지의 사용 권한은 변경될 수 있으므로 배포 시점에 다시 확인한다.
- 2026-07-23 API 조회에서 SDXL 베이스는 credit 요구와 derivatives 제한이 표시됐다.
- 자체 LoRA를 공개 배포하는 것이 베이스 모델 권한과 충돌하지 않는지 별도로 확인해야 한다.
- ControlNet 원 모델은 OpenRAIL++로 공개되어 있으나 실제 사용 파일의 원 저장소 고지사항도 함께 확인한다.
- 학습 데이터의 저작권과 개인정보 상태가 확정되기 전에는 공개 저장소나 공개 스토리지에 올리지 않는다.
- 팀 내부 공유와 공개 배포를 같은 것으로 취급하지 않는다.

이 문서는 법률 자문이 아니다. 공개 배포 전 모델 페이지의 최신 약관과 원 라이선스 전문을 검토한다.

## 외부 백업

RunPod 종료 전에 다음 자료를 로컬로 내려받았다.

- LoRA 6개
- VAE 1개
- ControlNet 1개
- 학습 데이터 압축파일
- 입력 후보 1개와 고유 출력 PNG 45개
- GitHub용 설정 및 환경 기록
- 체크섬과 인계 보고서
- JupyterLab이 만든 전체 다운로드 ZIP

총 검증 대상 용량은 약 3.63 GiB이다. 로컬에서 체크섬 13개가 모두 일치함을 다시 확인했다. SDXL 베이스는 백업에서 제외했으며 동일한 Civitai 버전을 다시 받은 뒤 해시를 비교한다.
