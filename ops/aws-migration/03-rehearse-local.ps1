<#
.SYNOPSIS
로컬 Docker PostgreSQL 로 복원 리허설. RDS 를 기다리지 않고 실행한다.

.DESCRIPTION
확장 미지원, 소유권 오류, --single-transaction 실패, 시퀀스 누락은 복원 대상이
RDS 든 로컬이든 똑같이 재현된다. 여기서 먼저 전부 잡고, RDS 가 준비되면
같은 절차를 엔드포인트만 바꿔 반복한다.

RDS 에만 있는 변수는 TLS(verify-full)와 확장 허용 목록 두 가지뿐이므로
이 스크립트가 통과해도 RDS 복원 때 그 둘은 다시 확인해야 한다.

.EXAMPLE
.\03-rehearse-local.ps1 -DumpPath "$HOME\LeafLogBackups\20260907-101500-rehearsal\leaflog.dump" -PgMajor 18
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$DumpPath,
    [Parameter(Mandatory = $true)][int]$PgMajor,
    [string]$ContainerName = 'leaflog-pg-rehearsal',
    [int]$HostPort = 5433,
    [string]$RehearsalDb = 'leaflog_rehearsal'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $DumpPath)) { throw "덤프 파일이 없습니다: $DumpPath" }
$dumpItem   = Get-Item -LiteralPath $DumpPath
$resultsDir = $dumpItem.DirectoryName

docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker 가 실행 중이 아닙니다. Docker Desktop 을 먼저 시작하세요.' }

# 기존 컨테이너를 건드리지 않는다. 남아 있으면 지우지 말고 중단한다.
$existing = docker ps -a --filter "name=^/$ContainerName$" --format '{{.Names}}'
if ($existing) {
    throw "컨테이너 '$ContainerName' 가 이미 있습니다. 내용을 확인한 뒤 직접 정리하세요: docker rm -f $ContainerName"
}

# 리허설 컨테이너는 매번 버리는 것이므로 비밀번호도 임시값을 새로 만든다.
function New-ThrowawayPassword {
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', ''
}
$adminPw = New-ThrowawayPassword
$appPw   = New-ThrowawayPassword

try {
    # --- 1. 원본과 같은 메이저 버전으로 컨테이너 기동 ---------------------
    Write-Host "[1/7] postgres:$PgMajor 기동 (127.0.0.1:$HostPort)" -ForegroundColor Cyan
    docker run -d --name $ContainerName -e POSTGRES_PASSWORD=$adminPw -p "127.0.0.1:${HostPort}:5432" "postgres:$PgMajor" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '컨테이너 기동 실패' }

    Write-Host '[2/7] 준비 대기'
    $ready = $false
    foreach ($i in 1..60) {
        docker exec $ContainerName pg_isready -U postgres -q 2>$null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 1000
    }
    if (-not $ready) {
        docker logs --tail 30 $ContainerName
        throw 'PostgreSQL 준비 시간 초과'
    }

    # --- 2. 필요한 파일을 컨테이너로 --------------------------------------
    Write-Host '[3/7] 덤프와 스크립트 복사'
    Write-Host "  덤프 SHA-256: $((Get-FileHash -Algorithm SHA256 -LiteralPath $DumpPath).Hash)"
    docker cp $DumpPath "${ContainerName}:/tmp/leaflog.dump" | Out-Null
    docker cp (Join-Path $PSScriptRoot '01-survey.sql') "${ContainerName}:/tmp/01-survey.sql" | Out-Null
    $dbSetup = Join-Path $PSScriptRoot '..\..\apps\api\scripts\db-setup.sql'
    if (-not (Test-Path -LiteralPath $dbSetup)) { throw "db-setup.sql 을 찾을 수 없습니다: $dbSetup" }
    docker cp $dbSetup "${ContainerName}:/tmp/db-setup.sql" | Out-Null

    # --- 3. 빈 DB 생성 ----------------------------------------------------
    # 기존 DB 를 삭제하거나 --clean 으로 밀지 않는다.
    Write-Host "[4/7] 빈 DB '$RehearsalDb' 생성"
    docker exec $ContainerName createdb -U postgres $RehearsalDb
    if ($LASTEXITCODE -ne 0) { throw "DB 생성 실패 — 같은 이름이 이미 있으면 -RehearsalDb 로 다른 이름을 쓰세요" }

    # --- 4. 복원 ----------------------------------------------------------
    # --no-owner/--no-acl: 원본 소유자·권한은 가져오지 않고 아래에서 다시 설정한다.
    # --single-transaction --exit-on-error: 오류를 무시한 부분 복원 상태를 만들지 않는다.
    Write-Host '[5/7] pg_restore'
    docker exec $ContainerName pg_restore -U postgres --dbname=$RehearsalDb --no-owner --no-acl --single-transaction --exit-on-error /tmp/leaflog.dump
    if ($LASTEXITCODE -ne 0) {
        throw '복원 실패. 오류 내용을 확인하세요 — 미지원 확장이나 소유권 문제라면 RDS 에서도 같은 오류가 납니다.'
    }

    # --- 5. 앱 계정 권한 (기존 db-setup.sql 재사용) -----------------------
    Write-Host '[6/7] 앱 계정 leaflog_user 권한 설정'
    docker exec -e PGPASSWORD=$adminPw $ContainerName psql -U postgres -d postgres -v "app_pw=$appPw" -v "dbname=$RehearsalDb" -f /tmp/db-setup.sql
    if ($LASTEXITCODE -ne 0) { throw '앱 계정 권한 설정 실패' }

    # 실제 쓰기와 시퀀스 동작 확인. 트랜잭션을 롤백하므로 데이터는 남지 않는다.
    # 시퀀스가 복원되지 않았다면 여기서 PK 충돌로 실패한다.
    Write-Host '  쓰기/시퀀스 확인 (ROLLBACK)'
    $writeTest = @'
BEGIN;
INSERT INTO app_user (email, nickname) VALUES ('rehearsal-probe@invalid.test', 'probe') RETURNING user_id;
ROLLBACK;
'@
    $writeTest | docker exec -i -e PGPASSWORD=$appPw $ContainerName psql -U leaflog_user -h 127.0.0.1 -d $RehearsalDb -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw '앱 계정 쓰기 실패 — 권한 또는 시퀀스 복원 문제' }

    # --- 6. 복원 결과 조사 ------------------------------------------------
    Write-Host '[7/7] 복원 DB 기준선 조사'
    $restoredFile = Join-Path $resultsDir 'survey-restored-local.txt'
    docker exec $ContainerName psql -U postgres -d $RehearsalDb -f /tmp/01-survey.sql -o /tmp/survey-restored.txt
    if ($LASTEXITCODE -ne 0) { throw '복원 DB 조사 실패' }
    docker cp "${ContainerName}:/tmp/survey-restored.txt" $restoredFile | Out-Null

    Write-Host ''
    Write-Host '리허설 복원 성공' -ForegroundColor Green
    Write-Host ''
    Write-Host '다음: 원본과 복원 결과를 대조하세요.' -ForegroundColor Cyan
    $sourceFile = Join-Path $resultsDir 'survey-source.txt'
    Write-Host "  Compare-Object (Get-Content '$sourceFile') (Get-Content '$restoredFile')"
    Write-Host ''
    Write-Host '차이가 나면 정상인 것과 아닌 것을 구분하세요:'
    Write-Host '  정상  — 1번 섹션의 DB 이름/접속 계정/서버 패치 버전'
    Write-Host '  비정상 — 2번(확장), 3번(건수), 4번(시퀀스), 5번(컬럼) 의 차이'
    Write-Host ''
    Write-Host '앱을 이 DB에 붙여 확인하려면 apps/api/.env 에:'
    Write-Host "  DATABASE_URL=postgresql://leaflog_user:$appPw@127.0.0.1:$HostPort/$RehearsalDb"
    Write-Host '  (임시 컨테이너용 비밀번호입니다. 커밋하지 마세요.)' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '정리:'
    Write-Host "  docker rm -f $ContainerName"
}
catch {
    Write-Host ''
    Write-Host "리허설 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "컨테이너는 조사용으로 남겨둡니다. 로그: docker logs $ContainerName" -ForegroundColor Yellow
    Write-Host "직접 확인: docker exec -it $ContainerName psql -U postgres"
    Write-Host "정리: docker rm -f $ContainerName"
    throw
}
