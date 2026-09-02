# 학교 PC GPU 런타임

학교 PC의 RTX 3060 12GB를 Ollama와 SDXL Forge가 번갈아 사용하도록 구성한다. 두 모델을 동시에 GPU에 올리지 않는 것이 전제다.

## 기본 동작

- WSL이 시작되면 `ollama.service`가 자동 실행된다.
- Ollama 서버만 시작되며 Qwen 모델은 요청이 들어올 때 로드된다.
- Ollama는 비정상 종료 때 재시작하지만, SDXL 전환을 위한 정상 종료 때는 재시작하지 않는다.
- SDXL이 필요할 때 `leaflog-gpu sdxl`을 실행한다.
- 생성 작업이 끝나면 반드시 `leaflog-gpu ollama`를 실행한다.
- 전환 중에는 파일 잠금을 사용하며, `systemd` 서비스도 서로 충돌하도록 설정돼 있다.
- Forge 시작 실패 시 전환 스크립트가 Forge를 종료하고 Ollama를 복구한다.
- 고정된 Forge 버전의 ControlNet API 초기화 오류는 설치 시 `forge-api-controlnet.patch`로 보정한다.
- Forge 준비 완료는 기본 API뿐 아니라 img2img ControlNet 스크립트 등록까지 확인한다.

## 명령

WSL Ubuntu의 `leaflog` 계정에서 실행한다.

```bash
leaflog-gpu status
leaflog-gpu sdxl
leaflog-gpu ollama
```

Forge 로그:

```bash
journalctl -u leaflog-forge -f
```

Ollama 로그:

```bash
journalctl -u ollama -f
```

## API 주소

- Ollama: `http://127.0.0.1:11434`
- Forge: `http://127.0.0.1:7860`

Forge는 인증 없이 외부 네트워크에 노출하지 않는다. 다른 PC에서 WebUI를 열 때는 SSH 터널을 사용한다.

```powershell
ssh -L 7860:127.0.0.1:7860 admin@<school-gpu-host>
```

터널을 연 상태에서 `http://127.0.0.1:7860`으로 접속한다.

## 애플리케이션 연결 원칙

모바일 앱이 시스템 명령을 직접 실행하지 않는다. 학교 PC에서 실행되는 FastAPI GPU 작업자가 다음 순서를 담당한다.

1. 서버 전역 GPU 작업 잠금 획득
2. `sudo -n /usr/local/sbin/leaflog-gpu-mode sdxl`
3. Forge의 `/sdapi/v1/img2img` 호출
4. 성공 또는 실패와 관계없이 `sudo -n /usr/local/sbin/leaflog-gpu-mode ollama`
5. GPU 작업 잠금 해제

현재 sudo 권한은 `leaflog-gpu-mode` 스크립트 하나에만 허용한다. 스크립트는 `ollama`, `sdxl`, `status` 외의 인자를 거부한다.

FastAPI 캐릭터 생성 작업을 학교 WSL에서 실행할 때 `apps/api/.env`에 다음 값을 둔다.

```dotenv
FORGE_API_URL=http://127.0.0.1:7860
CHARACTER_GPU_MODE_COMMAND=/usr/local/bin/leaflog-gpu
CHARACTER_RESTORE_OLLAMA=true
CHARACTER_PUBLIC_BASE_URL=http://<school-gpu-host>:8000
```

`CHARACTER_PUBLIC_BASE_URL`은 모바일 기기가 실제로 접근할 수 있는 주소로 바꿔야 한다. 모바일 기기가
학교 PC의 Tailscale 주소를 직접 사용할 경우 모바일에도 같은 tailnet 연결이 필요하다.

FastAPI를 개발 PC에서 실행하는 경우에는 SSH 키 인증과 다음 설정을 사용한다. 캐릭터 생성 요청이
학교 PC의 GPU 모드 전환과 Forge 터널 복구를 자동으로 수행하므로 수동으로 `leaflog-gpu sdxl`이나
`ssh -L`을 먼저 실행할 필요가 없다.

```dotenv
FORGE_API_URL=http://127.0.0.1:7860
CHARACTER_GPU_MODE_COMMAND=
CHARACTER_GPU_SSH_HOST=<school-gpu-host>
CHARACTER_GPU_SSH_USER=<windows-ssh-user>
CHARACTER_GPU_SSH_IDENTITY_FILE=~/.ssh/<private-key-file>
CHARACTER_GPU_SSH_WSL_DISTRO=Ubuntu
CHARACTER_GPU_SSH_WSL_USER=leaflog
CHARACTER_RESTORE_OLLAMA=true
```

## 고정 경로

- Forge: `/home/leaflog/stable-diffusion-webui-forge-recovered`
- Python: `/home/leaflog/miniforge3/envs/forge/bin/python`
- 모델 저장소: `/home/leaflog/leaflog-ai-models`
- 서비스: `/etc/systemd/system/leaflog-forge.service`
- 전환 도구: `/usr/local/sbin/leaflog-gpu-mode`

모델 저장소는 손상된 예전 Forge 체크아웃과 분리한다. 기존 대용량 파일은 hard link로 보존하므로 설치 과정에서 모델 용량이 중복되지 않는다.

## 설치

학교 PC의 WSL에 이 디렉터리를 전달한 뒤 Linux 서비스를 설치한다.

```bash
cd ops/school-gpu
sudo bash install.sh
```

그다음 학교 PC의 관리자 PowerShell에서 WSL 유지 예약 작업을 설치한다.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-wsl-keepalive.ps1
```

학교 PC의 32GB RAM 중 16GB를 WSL이 사용할 수 있도록 메모리 설정을 적용한다.

```powershell
.\configure-wsl-memory.ps1
```

설정값은 WSL RAM 16GB, swap 4GB다. Windows에는 물리 RAM 16GB가 남고 Ollama와 Forge는 동시에 실행하지 않는다.

## 성능 기준

동일한 1024x1024 img2img + SDXL LoRA + ControlNet Canny, 25 steps 요청으로 확인한 값이다.

- WSL RAM 7.8GB: 총 768.4초, Forge `Memory cleanup` 290.04초
- WSL RAM 16GB + `cudaMallocAsync`: 총 71.8초, `Memory cleanup` 1.95초

샘플링 자체보다 RAM 부족으로 인한 모델 오프로딩과 메모리 정리가 병목이었다. `.wslconfig`의 `memory=16GB`를 임의로 낮추지 않는다. Windows RAM 또는 Commit 사용량이 다시 비정상적으로 증가하면 두 모델을 동시에 실행하지 않았는지 먼저 확인한다.

예약 작업 이름은 `LeafLog WSL GPU Runtime`이다. Windows 부팅 또는 `admin` 로그인 시 Ubuntu에서 자원을 거의 사용하지 않는 대기 프로세스를 실행해, API 요청 사이에 WSL이 자동 종료되지 않도록 한다. WSL이 비정상 종료되면 다음 시작 시 기본 Ollama 모드로 복구된다.

설치 후 기본 상태는 Ollama이며 Forge 서비스는 부팅 시 자동 실행되지 않는다.

## PostgreSQL 개발 PC 허용

개발 PC의 Tailscale IP가 바뀌거나 새 장치로 접속하면 학교 PostgreSQL이 연결을 거부한다. 학교 PC에 SSH로 접속해 다음 스크립트를 실행하면 현재 SSH 클라이언트의 Tailscale IP 하나만 `/32`로 허용한다.

```powershell
.\configure-postgres-tailscale-client.ps1
```

대학 tailnet 전체 대역을 허용하지 않는다. 스크립트는 `100.64.0.0/10` 안의 현재 클라이언트 주소인지 검사하고 `leaflog` DB의 `leaflog_user`에만 접근을 허용한다.
