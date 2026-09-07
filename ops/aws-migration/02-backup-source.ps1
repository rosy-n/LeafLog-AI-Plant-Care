<#
.SYNOPSIS
학교 PostgreSQL 백업 + 검증 기준선 기록. 학교 Windows 의 PowerShell 에서 실행한다.

.DESCRIPTION
이전 절차에서 pg_dump 는 두 번 뜬다.
  -Label rehearsal : 리허설용 1차 백업. 버려도 되는 사본.
  -Label final     : 쓰기 중지 직후의 최종 백업. 이것이 실제로 운영에 올라간다.
리허설 덤프로 최종 복원을 하면 그 사이 기간의 UPDATE/DELETE 가 전부 사라진다.

.EXAMPLE
.\02-backup-source.ps1 -Label rehearsal
#>
[CmdletBinding()]
param(
    [ValidateSet('rehearsal', 'final')]
    [string]$Label = 'rehearsal',
    [string]$PgBin,
    [string]$SourceHost,
    [int]$SourcePort = 5432,
    [string]$SourceUser,
    [string]$SourceDb,
    [string]$OutRoot = (Join-Path $HOME 'LeafLogBackups')
)

$ErrorActionPreference = 'Stop'

function Read-Required([string]$Current, [string]$Prompt) {
    if ([string]::IsNullOrWhiteSpace($Current)) { return (Read-Host $Prompt) }
    return $Current
}

$PgBin      = Read-Required $PgBin      'PostgreSQL bin 폴더 전체 경로 (예: C:\Program Files\PostgreSQL\18\bin)'
$SourceHost = Read-Required $SourceHost '학교 PostgreSQL 호스트'
$SourceUser = Read-Required $SourceUser '백업 권한이 있는 DB 사용자'
$SourceDb   = Read-Required $SourceDb   '원본 DB 이름'

$PsqlExe      = Join-Path $PgBin 'psql.exe'
$PgDumpExe    = Join-Path $PgBin 'pg_dump.exe'
$PgRestoreExe = Join-Path $PgBin 'pg_restore.exe'
foreach ($exe in @($PsqlExe, $PgDumpExe, $PgRestoreExe)) {
    if (-not (Test-Path -LiteralPath $exe)) { throw "실행 파일이 없습니다: $exe" }
}

# 비밀번호는 인자나 파일에 남기지 않고 프로세스 환경변수로만 전달하고, 끝나면 지운다.
$secure = Read-Host "DB 사용자 '$SourceUser' 비밀번호" -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

try {
    $common = @('-h', $SourceHost, '-p', $SourcePort, '-U', $SourceUser, '-d', $SourceDb)

    # --- 1. 접속과 대상 DB 확인 -------------------------------------------
    Write-Host '[1/5] 원본 DB 확인' -ForegroundColor Cyan
    $serverVersion = & $PsqlExe @common -At -c 'SHOW server_version;'
    if ($LASTEXITCODE -ne 0) { throw '원본 DB 접속 실패' }
    Write-Host "  서버 버전: $serverVersion"
    Write-Host "  DB       : $SourceDb @ $SourceHost"

    # --- 2. pg_dump 버전이 서버보다 낮으면 중단 ---------------------------
    # 원본보다 오래된 pg_dump 는 사용할 수 없다.
    $dumpVersionText = (& $PgDumpExe --version) -join ' '
    $serverMajor = [int](($serverVersion -split '[.\s]')[0])
    $dumpMajor   = [int]([regex]::Match($dumpVersionText, '(\d+)').Groups[1].Value)
    Write-Host "[2/5] 버전 대조: 서버 $serverMajor / pg_dump $dumpMajor"
    if ($dumpMajor -lt $serverMajor) {
        throw "pg_dump($dumpMajor) 가 서버($serverMajor) 보다 낮습니다. 같은 메이저 버전 도구로 백업하세요."
    }
    Write-Host "  RDS 엔진은 메이저 $serverMajor 로 만들어야 합니다 (다운그레이드 불가)." -ForegroundColor Yellow

    # --- 3. 출력 폴더 -----------------------------------------------------
    $stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
    $outDir = Join-Path $OutRoot "$stamp-$Label"
    New-Item -ItemType Directory -Path $outDir | Out-Null
    Write-Host "[3/5] 출력 폴더: $outDir"

    # --- 4. 검증 기준선 기록 ----------------------------------------------
    # 원본은 계속 사용되므로 건수는 이 시점의 값이다. final 때 다시 기록한다.
    Write-Host '[4/5] 검증 기준선 조사'
    $surveySql  = Join-Path $PSScriptRoot '01-survey.sql'
    $surveyFile = Join-Path $outDir 'survey-source.txt'
    & $PsqlExe @common -f $surveySql -o $surveyFile
    if ($LASTEXITCODE -ne 0) { throw '기준선 조사 실패' }

    # --- 5. 덤프와 무결성 확인 --------------------------------------------
    # PowerShell 에서 바이너리 덤프를 리다이렉션(>)으로 만들면 깨진다. -f 를 사용한다.
    Write-Host '[5/5] pg_dump (-Fc)'
    $dumpFile = Join-Path $outDir 'leaflog.dump'
    & $PgDumpExe @common -Fc -f $dumpFile
    if ($LASTEXITCODE -ne 0) { throw '백업 실패 — 이후 단계로 넘어가지 않습니다' }

    & $PgRestoreExe --list $dumpFile | Out-File -FilePath (Join-Path $outDir 'dump-toc.txt') -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw '백업 목차 검사 실패 — 덤프가 손상되었습니다' }

    $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $dumpFile
    $hash.Hash | Out-File -FilePath (Join-Path $outDir 'leaflog.dump.sha256') -Encoding utf8

    Write-Host ''
    Write-Host '완료' -ForegroundColor Green
    Write-Host "  덤프    : $dumpFile"
    Write-Host "  크기    : $([math]::Round((Get-Item $dumpFile).Length / 1MB, 2)) MB"
    Write-Host "  SHA-256 : $($hash.Hash)"
    Write-Host "  기준선  : $surveyFile"
    Write-Host ''
    Write-Host '덤프에는 개인정보와 비밀번호 해시가 들어 있습니다. GitHub 에 올리지 마세요.' -ForegroundColor Yellow
    if ($Label -eq 'rehearsal') {
        Write-Host '다음: .\03-rehearse-local.ps1 -DumpPath "' -NoNewline
        Write-Host $dumpFile -NoNewline
        Write-Host "`" -PgMajor $serverMajor"
    }
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
