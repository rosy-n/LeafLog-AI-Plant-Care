$ErrorActionPreference = "Stop"

$pgRoot = "C:\Program Files\PostgreSQL\18"
$hbaPath = Join-Path $pgRoot "data\pg_hba.conf"
$pgCtlPath = Join-Path $pgRoot "bin\pg_ctl.exe"
$clientIpText = ($env:SSH_CLIENT -split " ")[0]

if (-not $clientIpText) {
    throw "SSH_CLIENT is empty. Run this script through the Tailscale SSH connection."
}

$clientIp = [System.Net.IPAddress]::Parse($clientIpText)
$octets = $clientIp.GetAddressBytes()
if ($octets.Length -ne 4 -or $octets[0] -ne 100 -or $octets[1] -lt 64 -or $octets[1] -gt 127) {
    throw "Refusing non-Tailscale client address: $clientIpText"
}

$rule = "host    leaflog    leaflog_user    $clientIpText/32    scram-sha-256"
$existing = Get-Content -LiteralPath $hbaPath

if ($existing -notcontains $rule) {
    $backupPath = "$hbaPath.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
    Copy-Item -LiteralPath $hbaPath -Destination $backupPath
    Add-Content -LiteralPath $hbaPath -Value "`r`n# LeafLog developer via Tailscale`r`n$rule" -Encoding ascii
    Write-Host "Added PostgreSQL client rule for $clientIpText"
    Write-Host "Backup: $backupPath"
} else {
    Write-Host "PostgreSQL client rule already exists for $clientIpText"
}

& $pgCtlPath reload -D (Join-Path $pgRoot "data")
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL configuration reload failed."
}
