#!/usr/bin/env bash
set -Eeuo pipefail

readonly LEAFLOG_USER="leaflog"
readonly FORGE_ROOT="/home/leaflog/stable-diffusion-webui-forge-recovered"
readonly LEGACY_MODEL_ROOT="/home/leaflog/stable-diffusion-webui-forge/models"
readonly MODEL_ROOT="/home/leaflog/leaflog-ai-models"
readonly FORGE_PYTHON="/home/leaflog/miniforge3/envs/forge/bin/python"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly FORGE_API_PATCH="$SCRIPT_DIR/forge-api-controlnet.patch"

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer as root." >&2
  exit 1
fi

for path in "$FORGE_ROOT/launch.py" "$FORGE_PYTHON"; do
  if [[ ! -e $path ]]; then
    echo "Required path is missing: $path" >&2
    exit 1
  fi
done

if git -C "$FORGE_ROOT" apply --reverse --check "$FORGE_API_PATCH" >/dev/null 2>&1; then
  echo "Forge ControlNet API patch is already applied."
elif git -C "$FORGE_ROOT" apply --check "$FORGE_API_PATCH"; then
  runuser -u "$LEAFLOG_USER" -- git -C "$FORGE_ROOT" apply "$FORGE_API_PATCH"
else
  echo "Forge ControlNet API patch does not match the installed Forge checkout." >&2
  exit 1
fi

install -d -o "$LEAFLOG_USER" -g "$LEAFLOG_USER" \
  "$MODEL_ROOT/Stable-diffusion" \
  "$MODEL_ROOT/Lora" \
  "$MODEL_ROOT/VAE" \
  "$MODEL_ROOT/ControlNet"

link_model() {
  local category=$1
  local filename=$2
  local source="$LEGACY_MODEL_ROOT/$category/$filename"
  local stored="$MODEL_ROOT/$category/$filename"
  local forge_link="$FORGE_ROOT/models/$category/$filename"

  if [[ ! -f $source && ! -f $stored ]]; then
    echo "Model is missing: $filename" >&2
    exit 1
  fi

  if [[ ! -f $stored ]]; then
    # The model store and legacy Forge tree share one ext4 filesystem.
    # A hard link keeps the old checkout intact without duplicating large files.
    ln "$source" "$stored"
  fi

  chown "$LEAFLOG_USER:$LEAFLOG_USER" "$stored"
  install -d -o "$LEAFLOG_USER" -g "$LEAFLOG_USER" "$(dirname "$forge_link")"
  ln -sfn "$stored" "$forge_link"
  chown -h "$LEAFLOG_USER:$LEAFLOG_USER" "$forge_link"
}

link_model "Stable-diffusion" "pixelArtDiffusionXL_spriteShaper.safetensors"
link_model "Lora" "plantpet_sprite_lora_v2.safetensors"
link_model "VAE" "sdxl_vae.safetensors"
link_model "ControlNet" "diffusers_xl_canny_mid.safetensors"

install -m 0755 "$SCRIPT_DIR/leaflog-gpu-mode" /usr/local/sbin/leaflog-gpu-mode
ln -sfn /usr/local/sbin/leaflog-gpu-mode /usr/local/bin/leaflog-gpu
install -m 0644 "$SCRIPT_DIR/leaflog-forge.service" /etc/systemd/system/leaflog-forge.service

install -d /etc/systemd/system/ollama.service.d
cat >/etc/systemd/system/ollama.service.d/leaflog-gpu.conf <<'EOF'
[Service]
# A deliberate SDXL transition is a clean stop and must not restart Ollama.
Restart=on-failure
RestartSec=3
EOF

cat >/etc/sudoers.d/leaflog-gpu-mode <<'EOF'
leaflog ALL=(root) NOPASSWD: /usr/local/sbin/leaflog-gpu-mode *
EOF
chmod 0440 /etc/sudoers.d/leaflog-gpu-mode
visudo -cf /etc/sudoers.d/leaflog-gpu-mode >/dev/null

systemctl daemon-reload
systemctl disable leaflog-forge.service >/dev/null 2>&1 || true
systemctl enable ollama.service >/dev/null
systemctl stop leaflog-forge.service
systemctl start ollama.service

echo "LeafLog GPU runtime installed."
/usr/local/sbin/leaflog-gpu-mode status
