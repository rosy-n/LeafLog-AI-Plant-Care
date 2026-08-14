$ErrorActionPreference = "Stop"

$taskName = "LeafLog WSL GPU Runtime"
$configPath = Join-Path $env:USERPROFILE ".wslconfig"

$config = @"
[wsl2]
memory=16GB
swap=4GB
networkingMode=mirrored
"@

Set-Content -LiteralPath $configPath -Value $config -Encoding ascii

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}

wsl.exe --shutdown
Start-Sleep -Seconds 3

if ($task) {
    Start-ScheduledTask -TaskName $taskName
} else {
    Start-Process -FilePath wsl.exe `
        -ArgumentList "-d", "Ubuntu", "--exec", "/bin/sleep", "infinity" `
        -WindowStyle Hidden
}

Start-Sleep -Seconds 5
Write-Host "Applied WSL memory configuration:"
Get-Content -LiteralPath $configPath
wsl.exe -d Ubuntu -- free -h
