# 환경 스냅샷

## 공통 GPU

- GPU: NVIDIA H100 80GB HBM3
- NVIDIA driver: 550.127.05
- `nvidia-smi` CUDA: 12.4

전체 출력은 `nvidia-smi.txt`에 있다.

## Kohya

- 저장소: `https://github.com/bmaltais/kohya_ss.git`
- Kohya GUI commit: `4161d1d80ad554f7801c584632665d6825994062`
- sd-scripts commit: `3e6935a07edcb944407840ef74fcaf6fcad352f7`
- Python: 3.10.20
- PyTorch: 2.5.0+cu124
- CUDA runtime: 12.4
- cuDNN: 9.1.0

`kohya/`에는 commit, remote, status, submodule, runtime, pip freeze가 있다. `configs/`와 `train_data/`는 원 저장소에서 untracked 상태였으며 필요한 설정과 데이터는 별도로 보존했다.

## Forge

- 저장소: `https://github.com/lllyasviel/stable-diffusion-webui-forge.git`
- commit: `bfee03d8d9415a925616f40ede030fe7a51cbcfd`
- Python: 3.10.20
- PyTorch: 2.1.2+cu121
- CUDA runtime: 12.1
- cuDNN: 8.9.2

`forge/`에는 commit, remote, status, runtime, pip freeze와 dirty working tree patch가 있다. Marigold 전처리기 파일이 비활성화된 상태였지만 Canny 추론과 직접 관련된 변경은 확인되지 않았다.

실제 Forge 실행 명령과 `--api` 사용 여부는 기록되지 않았다.
