$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-GruposIniSections {
    param([Parameter(Mandatory = $true)][string]$Path)

    $sections = [ordered]@{}
    $current = $null
    foreach ($rawLine in [System.IO.File]::ReadAllLines($Path)) {
        $line = $rawLine.Trim()
        if ($line -match '^\[([^\]]+)\]$') {
            $current = $Matches[1]
            if (-not $sections.Contains($current)) {
                $sections[$current] = [ordered]@{}
            }
            continue
        }
        if (-not $current -or -not $line -or $line.StartsWith(';') -or $line.StartsWith('#')) {
            continue
        }
        $separator = $line.IndexOf('=')
        if ($separator -gt 0) {
            $key = $line.Substring(0, $separator).Trim()
            $value = $line.Substring($separator + 1).Trim()
            $sections[$current][$key] = $value
        }
    }
    return $sections
}

function Resolve-GruposStoredPath {
    param(
        [Parameter(Mandatory = $true)][string]$FirefoxRoot,
        [Parameter(Mandatory = $true)][string]$StoredPath,
        [string]$IsRelative = "1"
    )
    if ($IsRelative -eq "0" -or [System.IO.Path]::IsPathRooted($StoredPath)) {
        return [System.IO.Path]::GetFullPath($StoredPath)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $FirefoxRoot $StoredPath))
}

function Test-GruposProfilePath {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        return $false
    }
    foreach ($marker in @("prefs.js", "compatibility.ini", "places.sqlite", "sessionstore-backups")) {
        if (Test-Path -LiteralPath (Join-Path $Path $marker)) {
            return $true
        }
    }
    return $false
}

function Add-GruposUniquePath {
    param(
        [AllowEmptyCollection()][Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$List,
        [Parameter(Mandatory = $true)][string]$Path
    )
    if ($Path -and -not $List.Contains($Path)) {
        [void]$List.Add($Path)
    }
}

function Get-GruposFirefoxRoots {
    $roots = [System.Collections.Generic.List[string]]::new()
    if ($env:APPDATA) {
        Add-GruposUniquePath -List $roots -Path (Join-Path $env:APPDATA "Mozilla\Firefox")
    }
    if ($env:LOCALAPPDATA) {
        Add-GruposUniquePath -List $roots -Path (Join-Path $env:LOCALAPPDATA "Mozilla\Firefox")
        $packagesRoot = Join-Path $env:LOCALAPPDATA "Packages"
        if (Test-Path -LiteralPath $packagesRoot -PathType Container) {
            foreach ($package in Get-ChildItem -LiteralPath $packagesRoot -Directory -Filter "Mozilla.Firefox*" -ErrorAction SilentlyContinue) {
                foreach ($relativeRoot in @(
                    "LocalCache\Roaming\Mozilla\Firefox",
                    "LocalState\Mozilla\Firefox"
                )) {
                    Add-GruposUniquePath -List $roots -Path (Join-Path $package.FullName $relativeRoot)
                }
            }
        }
    }
    if ($env:USERPROFILE) {
        Add-GruposUniquePath -List $roots -Path (Join-Path $env:USERPROFILE "AppData\Roaming\Mozilla\Firefox")
    }
    return $roots
}

function Get-GruposProfileCandidates {
    param([Parameter(Mandatory = $true)][string]$FirefoxRoot)

    $candidates = [System.Collections.Generic.List[string]]::new()
    $iniPath = Join-Path $FirefoxRoot "profiles.ini"
    if (Test-Path -LiteralPath $iniPath -PathType Leaf) {
        $sections = Get-GruposIniSections -Path $iniPath
        foreach ($sectionName in @($sections.Keys | Where-Object { $_ -like "Install*" })) {
            $storedPath = $sections[$sectionName]["Default"]
            if ($storedPath) {
                $candidate = Resolve-GruposStoredPath -FirefoxRoot $FirefoxRoot -StoredPath $storedPath
                if (Test-GruposProfilePath -Path $candidate) {
                    Add-GruposUniquePath -List $candidates -Path $candidate
                }
            }
        }

        $profileSections = @($sections.Keys | Where-Object { $_ -like "Profile*" } | Sort-Object {
            if ($sections[$_]["Default"] -eq "1") { 0 } else { 1 }
        })
        foreach ($sectionName in $profileSections) {
            $storedPath = $sections[$sectionName]["Path"]
            if (-not $storedPath) { continue }
            $isRelative = $sections[$sectionName]["IsRelative"]
            if (-not $isRelative) { $isRelative = "1" }
            $candidate = Resolve-GruposStoredPath -FirefoxRoot $FirefoxRoot -StoredPath $storedPath -IsRelative $isRelative
            if (Test-GruposProfilePath -Path $candidate) {
                Add-GruposUniquePath -List $candidates -Path $candidate
            }
        }
    }

    $profilesRoot = Join-Path $FirefoxRoot "Profiles"
    if (Test-Path -LiteralPath $profilesRoot -PathType Container) {
        foreach ($profileFolder in Get-ChildItem -LiteralPath $profilesRoot -Directory -ErrorAction SilentlyContinue) {
            if (Test-GruposProfilePath -Path $profileFolder.FullName) {
                Add-GruposUniquePath -List $candidates -Path $profileFolder.FullName
            }
        }
    }
    if (Test-Path -LiteralPath $FirefoxRoot -PathType Container) {
        foreach ($profileFolder in Get-ChildItem -LiteralPath $FirefoxRoot -Directory -ErrorAction SilentlyContinue) {
            if (Test-GruposProfilePath -Path $profileFolder.FullName) {
                Add-GruposUniquePath -List $candidates -Path $profileFolder.FullName
            }
        }
    }
    return $candidates
}

function Select-GruposFirefoxProfile {
    $selected = $null
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Escolha a pasta do perfil indicada em about:support"
        $dialog.ShowNewFolderButton = $false
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            $selected = $dialog.SelectedPath
        }
        $dialog.Dispose()
    } catch {
        $selected = Read-Host "Cole o caminho da pasta do perfil mostrado em about:support"
    }

    if ($selected -and (Test-GruposProfilePath -Path $selected)) {
        return [System.IO.Path]::GetFullPath($selected)
    }
    if ($selected) {
        Write-Host "A pasta escolhida não parece ser um perfil do Firefox: $selected" -ForegroundColor Yellow
    }
    return $null
}

function Get-GruposFirefoxProfile {
    param([string]$ProfilePath)

    if (-not $ProfilePath -and (Test-Path Env:GNB_FIREFOX_PROFILE)) {
        $ProfilePath = $env:GNB_FIREFOX_PROFILE
    }
    if ($ProfilePath) {
        $resolved = [System.IO.Path]::GetFullPath($ProfilePath)
        if (-not (Test-GruposProfilePath -Path $resolved)) {
            throw "O perfil informado não é válido: $resolved"
        }
        return $resolved
    }

    $roots = @(Get-GruposFirefoxRoots)
    $candidates = [System.Collections.Generic.List[string]]::new()
    foreach ($root in $roots) {
        foreach ($candidate in @(Get-GruposProfileCandidates -FirefoxRoot $root)) {
            Add-GruposUniquePath -List $candidates -Path $candidate
        }
    }

    if ($candidates.Count -gt 0) {
        $ranked = @($candidates | ForEach-Object {
            $stampSource = if (Test-Path -LiteralPath (Join-Path $_ "prefs.js")) {
                Join-Path $_ "prefs.js"
            } else {
                $_
            }
            [pscustomobject]@{
                Path = $_
                Stamp = (Get-Item -LiteralPath $stampSource).LastWriteTimeUtc
            }
        } | Sort-Object Stamp -Descending)
        return $ranked[0].Path
    }

    Write-Host ""
    Write-Host "O instalador verificou estes locais:" -ForegroundColor Yellow
    foreach ($root in $roots) {
        Write-Host "  - $root"
    }
    $manual = Select-GruposFirefoxProfile
    if ($manual) { return $manual }
    throw "Nenhum perfil do Firefox foi encontrado. Abra about:support e use o campo Pasta do perfil."
}

function Assert-GruposFirefoxClosed {
    if (Get-Process -Name "firefox" -ErrorAction SilentlyContinue) {
        throw "Feche todas as janelas do Firefox antes de continuar."
    }
}

function Backup-GruposFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Timestamp
    )
    if (Test-Path -LiteralPath $Path) {
        $destination = "$Path.backup-$Timestamp"
        $counter = 1
        while (Test-Path -LiteralPath $destination) {
            $destination = "$Path.backup-$Timestamp-$counter"
            $counter += 1
        }
        Copy-Item -LiteralPath $Path -Destination $destination
    }
}

function Write-GruposUtf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [AllowEmptyString()][Parameter(Mandatory = $true)][string]$Content
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}
