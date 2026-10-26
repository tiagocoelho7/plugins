. (Join-Path $PSScriptRoot "Visual-Common.ps1")

try {
    Assert-GruposFirefoxClosed

    $profileDir = Get-GruposFirefoxProfile
    $chromeDir = Join-Path $profileDir "chrome"
    $userChrome = Join-Path $chromeDir "userChrome.css"
    $styleTarget = Join-Path $chromeDir "grupos-na-barra.css"
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $importLine = '@import url("grupos-na-barra.css");'

    if (Test-Path -LiteralPath $userChrome) {
        $originalLines = [System.IO.File]::ReadAllLines($userChrome)
        $filteredLines = @($originalLines | Where-Object { $_.Trim() -ne $importLine })
        if ($filteredLines.Count -ne $originalLines.Count) {
            Backup-GruposFile -Path $userChrome -Timestamp $timestamp
            $content = if ($filteredLines.Count) {
                ($filteredLines -join "`r`n") + "`r`n"
            } else {
                ""
            }
            Write-GruposUtf8File -Path $userChrome -Content $content
        }
    }

    if (Test-Path -LiteralPath $styleTarget) {
        Remove-Item -LiteralPath $styleTarget -Force
    }

    Write-Host ""
    Write-Host "Visual removido com sucesso." -ForegroundColor Green
    Write-Host "Perfil: $profileDir"
    Write-Host ""
    Write-Host "A preferência de userChrome.css foi mantida para não quebrar outros estilos."
    Write-Host "Abra novamente o Firefox para concluir."
    exit 0
} catch {
    Write-Host ""
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
