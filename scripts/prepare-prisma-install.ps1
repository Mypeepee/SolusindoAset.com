param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$enginePath = Join-Path $projectRoot 'node_modules\.prisma\client\query_engine-windows.dll.node'

function Get-PrismaEngineUsers {
    foreach ($nodeProcess in (Get-Process -Name node -ErrorAction SilentlyContinue)) {
        try {
            $engine = @($nodeProcess.Modules | Where-Object { $_.FileName -ieq $enginePath })
            if ($engine.Count -gt 0) { $nodeProcess.Id }
        } catch {
            # A process may exit while its modules are being inspected.
            if (Get-Process -Id $nodeProcess.Id -ErrorAction SilentlyContinue) {
                throw "Tidak dapat memeriksa proses Node PID $($nodeProcess.Id). Hentikan proses proyek secara manual sebelum instalasi."
            }
        }
    }
}

$engineUsers = @(Get-PrismaEngineUsers)
if ($engineUsers.Count -eq 0) {
    Write-Host '[OK] Prisma Client tidak sedang dikunci proses Node.'
    exit 0
}
if ($CheckOnly) {
    Write-Host "[INFO] Prisma Client proyek dipakai PID: $($engineUsers -join ', ')."
    exit 0
}

foreach ($engineUserId in $engineUsers) {
    # Only a process that loaded this project's exact DLL can reach this point.
    $holder = Get-CimInstance Win32_Process -Filter "ProcessId = $engineUserId"
    if (-not $holder) { continue }
    $targetId = $engineUserId
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($holder.ParentProcessId)"
    # Stop the Next dev parent too so its file watcher cannot reopen the DLL.
    if ($parent -and $parent.Name -ieq 'node.exe' -and
        $parent.CommandLine -match 'next[\\/]dist[\\/]bin[\\/]next["\s]+dev(?:\s|$)') {
        $targetId = $parent.ProcessId
    }
    Write-Host "[INFO] Menghentikan proses proyek PID $targetId yang mengunci Prisma Client..."
    & taskkill.exe /PID $targetId /T /F | Out-Null
    if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $targetId -ErrorAction SilentlyContinue)) {
        throw "Proses PID $targetId belum berhenti. Instalasi dibatalkan agar Prisma Client tetap aman."
    }
}

for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (@(Get-PrismaEngineUsers).Count -eq 0) {
        Write-Host '[OK] Kunci Prisma Client sudah dilepas. Instalasi dapat dilanjutkan.'
        exit 0
    }
    Start-Sleep -Milliseconds 250
}
throw 'Prisma Client masih dipakai proses Node. Instalasi dibatalkan; hentikan proses proyek lalu ulangi.'
