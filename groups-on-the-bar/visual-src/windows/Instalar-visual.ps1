. (Join-Path $PSScriptRoot "Visual-Common.ps1")

try {
    Assert-GruposFirefoxClosed

    $styleSource = Join-Path $PSScriptRoot "grupos-na-barra.css"
    if (-not (Test-Path -LiteralPath $styleSource -PathType Leaf)) {
        throw "O arquivo grupos-na-barra.css precisa ficar ao lado deste instalador."
    }

    $profileDir = Get-GruposFirefoxProfile
    $chromeDir = Join-Path $profileDir "chrome"
    $userChrome = Join-Path $chromeDir "userChrome.css"
    $styleTarget = Join-Path $chromeDir "grupos-na-barra.css"
    $userJs = Join-Path $profileDir "user.js"
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $importLine = '@import url("grupos-na-barra.css");'
    $preferenceLine = 'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);'
    $preferencePattern = '(?m)^\s*user_pref\("toolkit\.legacyUserProfileCustomizations\.stylesheets"\s*,\s*(?:true|false)\s*\);\s*$'

    New-Item -ItemType Directory -Path $chromeDir -Force | Out-Null
    Copy-Item -LiteralPath $styleSource -Destination $styleTarget -Force

    $chromeContent = if (Test-Path -LiteralPath $userChrome) {
        [System.IO.File]::ReadAllText($userChrome)
    } else {
        ""
    }
    $hasImport = @($chromeContent -split "`r?`n" | Where-Object { $_.Trim() -eq $importLine }).Count -gt 0
    if (-not $hasImport) {
        Backup-GruposFile -Path $userChrome -Timestamp $timestamp
        $newChromeContent = if ($chromeContent) {
            "$importLine`r`n`r`n$chromeContent"
        } else {
            "$importLine`r`n"
        }
        Write-GruposUtf8File -Path $userChrome -Content $newChromeContent
    }

    $userJsContent = if (Test-Path -LiteralPath $userJs) {
        [System.IO.File]::ReadAllText($userJs)
    } else {
        ""
    }
    $newUserJsContent = if ([System.Text.RegularExpressions.Regex]::IsMatch($userJsContent, $preferencePattern)) {
        [System.Text.RegularExpressions.Regex]::Replace($userJsContent, $preferencePattern, $preferenceLine)
    } elseif ($userJsContent) {
        "$($userJsContent.TrimEnd())`r`n`r`n$preferenceLine`r`n"
    } else {
        "$preferenceLine`r`n"
    }
    if ($newUserJsContent -ne $userJsContent) {
        Backup-GruposFile -Path $userJs -Timestamp $timestamp
        Write-GruposUtf8File -Path $userJs -Content $newUserJsContent
    }

    Write-Host ""
    Write-Host "Visual instalado com sucesso." -ForegroundColor Green
    Write-Host "Perfil: $profileDir"
    Write-Host ""
    Write-Host "Abra novamente o Firefox para aplicar o chip colorido."
    exit 0
} catch {
    Write-Host ""
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
