[CmdletBinding()]
param(
    [ValidateSet('desktop')]
    [string]$Profile = 'desktop',
    [ValidateRange(128, 16384)]
    [int]$CompactionHeadroomTokens = 1024,
    [ValidateRange(128, 16384)]
    [int]$CompactionMaxTokens = 1024
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-EntryRange {
    param(
        [string[]]$Lines,
        [string]$Id,
        [switch]$Last
    )

    $foundRanges = New-Object System.Collections.Generic.List[object]
    $pattern = '^(?<indent> *)-\s+id:\s*' + [regex]::Escape($Id) + '\s*$'
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match $pattern) {
            $indent = $Matches['indent'].Length
            $end = $Lines.Count
            for ($j = $i + 1; $j -lt $Lines.Count; $j++) {
                if ($Lines[$j] -match '^(?<nextIndent> *)-\s+(?:id|insert|disable|remove):') {
                    if ($Matches['nextIndent'].Length -le $indent) {
                        $end = $j
                        break
                    }
                }
            }
            $foundRanges.Add([pscustomobject]@{ Start = $i; End = $end; Indent = $indent })
        }
    }

    if ($foundRanges.Count -eq 0) { return $null }
    if ($Last) { return $foundRanges[$foundRanges.Count - 1] }
    return $foundRanges[0]
}

function Set-CompactionConfig {
    param(
        [System.Collections.Generic.List[string]]$Lines,
        [int]$RowStart,
        [int]$RowEnd,
        [int]$RowIndent,
        [string]$Key,
        [int]$Value
    )

    $configIndent = $RowIndent + 2
    $configIndentText = ' ' * $configIndent
    $propertyIndent = $configIndent + 2
    $propertyIndentText = ' ' * $propertyIndent
    $configIndex = -1

    for ($i = $RowStart + 1; $i -lt $RowEnd; $i++) {
        if ($Lines[$i] -match ('^' + [regex]::Escape($configIndentText) + 'config:\s*$')) {
            $configIndex = $i
            break
        }
    }

    if ($configIndex -lt 0) {
        throw 'У compaction-basic отсутствует config-блок; формат установленной версии DSH не распознан.'
    }

    $found = -1
    for ($i = $configIndex + 1; $i -lt $RowEnd; $i++) {
        $line = $Lines[$i]
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
        if ($line -match '^(?<indent> *)[A-Za-z0-9_-]+\s*:') {
            $indentLength = $Matches['indent'].Length
            if ($indentLength -le $configIndent) { break }
            if ($indentLength -eq $propertyIndent -and $line -match ('^' + [regex]::Escape($propertyIndentText) + [regex]::Escape($Key) + '\s*:')) {
                $found = $i
                break
            }
        }
    }

    $newLine = $propertyIndentText + $Key + ': ' + $Value
    if ($found -ge 0) {
        $Lines[$found] = $newLine
    } else {
        $Lines.Insert($configIndex + 1, $newLine)
    }
}

function Get-BlockLines {
    param([string[]]$Lines, [object]$Range)
    $result = New-Object System.Collections.Generic.List[string]
    for ($i = $Range.Start; $i -lt $Range.End; $i++) { $result.Add($Lines[$i]) }
    return ,$result
}

function Invoke-DshDump {
    param([string[]]$Arguments, [string]$Label)

    $stderrPath = Join-Path $env:TEMP ("dsh-local-ai-" + [guid]::NewGuid().ToString('N') + '.stderr.log')
    try {
        $output = & dsh @Arguments 2> $stderrPath
        $exitCode = $LASTEXITCODE
        $text = @($output | ForEach-Object { [string]$_ }) -join "`n"
        if ($exitCode -ne 0) {
            $stderr = if (Test-Path $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw } else { '' }
            throw "$Label завершился с кодом $exitCode. $stderr"
        }
        if ([string]::IsNullOrWhiteSpace($text)) {
            $stderr = if (Test-Path $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw } else { '' }
            throw "$Label не вернул YAML-конфигурацию. $stderr"
        }
        return $text
    } finally {
        Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
    }
}

$dshCommand = Get-Command dsh -ErrorAction SilentlyContinue
if (-not $dshCommand) {
    throw 'Команда dsh не найдена. Установи DSH CLI через Application → Manage dsh Command и открой новое PowerShell-окно.'
}

$profileDirectory = Join-Path (Join-Path (Join-Path $env:USERPROFILE '.dsh') 'profiles') $Profile
$patchPath = Join-Path $profileDirectory 'cordis.patch.yml'
if (-not (Test-Path $profileDirectory -PathType Container)) {
    throw "Профиль DSH не найден: $profileDirectory"
}
if (-not (Test-Path $patchPath -PathType Leaf)) {
    throw "Файл профиля не найден: $patchPath"
}

Write-Host 'Читаю текущий стандартный preset из встроенных bundle DSH...' -ForegroundColor Cyan
$defaultOutput = Invoke-DshDump -Arguments @('--profile', $Profile, '--dump-default-config') -Label 'DSH --dump-default-config'
$defaultLines = @($defaultOutput -split "`r?`n")
$presetRange = Get-EntryRange -Lines $defaultLines -Id 'preset-standard' -Last
if (-not $presetRange) {
    throw 'Во встроенной конфигурации DSH не найден preset-standard. Профиль не изменён.'
}

$presetBlock = Get-BlockLines -Lines $defaultLines -Range $presetRange
$presetText = $presetBlock -join "`n"
if ($presetText -notmatch '(?m)^\s+id:\s*standard\s*$') {
    throw 'Найден preset-standard, но config.id: standard не подтверждён. Профиль не изменён.'
}
$compactionRange = Get-EntryRange -Lines ($presetBlock.ToArray()) -Id 'compaction-basic' -Last
if (-not $compactionRange) {
    throw 'В preset-standard не найден compaction-basic. Профиль не изменён.'
}

Set-CompactionConfig -Lines $presetBlock -RowStart $compactionRange.Start -RowEnd $compactionRange.End -RowIndent $compactionRange.Indent -Key 'headroomTokens' -Value $CompactionHeadroomTokens
$compactionRange = Get-EntryRange -Lines ($presetBlock.ToArray()) -Id 'compaction-basic' -Last
Set-CompactionConfig -Lines $presetBlock -RowStart $compactionRange.Start -RowEnd $compactionRange.End -RowIndent $compactionRange.Indent -Key 'maxTokens' -Value $CompactionMaxTokens

# A bundle preset file wraps the row in an `insert:` list. The profile patch
# needs the row itself, dedented to the root list; the wrapper is not copied.
$dedented = New-Object System.Collections.Generic.List[string]
$removeIndent = $presetRange.Indent
foreach ($line in $presetBlock) {
    if ($line.Length -ge $removeIndent -and $line.Substring(0, $removeIndent) -match '^ *$') {
        $dedented.Add($line.Substring($removeIndent))
    } else {
        $dedented.Add($line)
    }
}

$existingText = Get-Content -LiteralPath $patchPath -Raw
$profileLines = @($existingText -split "`r?`n")
# Remove every previous copy of this full-preset override so rerunning the
# installer is idempotent and does not leave duplicate preset rows.
while ($true) {
    $oldPresetRange = Get-EntryRange -Lines $profileLines -Id 'preset-standard' -Last
    if (-not $oldPresetRange) { break }
    $kept = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $profileLines.Count; $i++) {
        if ($i -lt $oldPresetRange.Start -or $i -ge $oldPresetRange.End) { $kept.Add($profileLines[$i]) }
    }
    $profileLines = $kept.ToArray()
}

$combined = New-Object System.Collections.Generic.List[string]
foreach ($line in $profileLines) { $combined.Add($line) }
while ($combined.Count -gt 0 -and [string]::IsNullOrWhiteSpace($combined[$combined.Count - 1])) { $combined.RemoveAt($combined.Count - 1) }
$combined.Add('')
foreach ($line in $dedented) { $combined.Add($line) }
$newText = ($combined -join "`n").TrimEnd() + "`n"

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = "$patchPath.before-local-ai-context-$timestamp.bak"
Copy-Item -LiteralPath $patchPath -Destination $backupPath -Force
[System.IO.File]::WriteAllText($patchPath, $newText, [System.Text.UTF8Encoding]::new($false))

try {
    Write-Host 'Проверяю итоговую собранную конфигурацию DSH...' -ForegroundColor Cyan
    $verifyOutput = Invoke-DshDump -Arguments @('--profile', $Profile, '--dump-config') -Label 'DSH --dump-config'
    $verifyLines = @($verifyOutput -split "`r?`n")
    $verifyPresetRange = Get-EntryRange -Lines $verifyLines -Id 'preset-standard' -Last
    if (-not $verifyPresetRange) { throw 'Итоговый dump-config не содержит preset-standard.' }
    $verifyPresetLines = @($verifyLines[$verifyPresetRange.Start..($verifyPresetRange.End - 1)])
    $verifyCompactionRange = Get-EntryRange -Lines $verifyPresetLines -Id 'compaction-basic' -Last
    if (-not $verifyCompactionRange) { throw 'В итоговом preset-standard не найден compaction-basic.' }
    $verifyCompactionText = ($verifyPresetLines[$verifyCompactionRange.Start..($verifyCompactionRange.End - 1)] -join "`n")
    if ($verifyCompactionText -notmatch ('(?m)^\s+headroomTokens:\s*' + $CompactionHeadroomTokens + '\s*$') -or
        $verifyCompactionText -notmatch ('(?m)^\s+maxTokens:\s*' + $CompactionMaxTokens + '\s*$')) {
        throw 'Итоговый preset-standard не подтвердил headroomTokens/maxTokens внутри compaction-basic. Возможно, более поздний home-level patch перекрывает профиль.'
    }
} catch {
    Copy-Item -LiteralPath $backupPath -Destination $patchPath -Force
    throw "Проверка не пройдена. Исходный cordis.patch.yml восстановлен из резервной копии. Причина: $($_.Exception.Message)"
}

Write-Host ''
Write-Host 'ГОТОВО: живой preset-standard подтверждён через dsh --dump-config.' -ForegroundColor Green
Write-Host "compaction-basic.headroomTokens = $CompactionHeadroomTokens"
Write-Host "compaction-basic.maxTokens      = $CompactionMaxTokens"
Write-Host "Резервная копия: $backupPath"
Write-Host 'Для контекста 11 776 и output reserve 2 944 остаётся pressure budget 7 808 токенов.' -ForegroundColor Cyan
Write-Host 'Полностью перезапусти DSH и открой новый чат.' -ForegroundColor Yellow
