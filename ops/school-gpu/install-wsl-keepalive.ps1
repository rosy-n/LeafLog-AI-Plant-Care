$ErrorActionPreference = "Stop"

$taskName = "LeafLog WSL GPU Runtime"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$wslPath = Join-Path $env:SystemRoot "System32\wsl.exe"

$action = New-ScheduledTaskAction `
    -Execute $wslPath `
    -Argument "-d Ubuntu --exec /bin/sleep infinity"

$triggers = @(
    New-ScheduledTaskTrigger -AtStartup
    New-ScheduledTaskTrigger -AtLogOn -User $currentUser
)

$principal = New-ScheduledTaskPrincipal `
    -UserId $currentUser `
    -LogonType S4U `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

$task = New-ScheduledTask `
    -Action $action `
    -Trigger $triggers `
    -Principal $principal `
    -Settings $settings

Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

$info = Get-ScheduledTaskInfo -TaskName $taskName
Write-Host "Installed scheduled task: $taskName"
Write-Host "Last result: $($info.LastTaskResult)"
wsl.exe -l -v
