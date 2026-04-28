param(
  [string]$PackageRoot = "",
  [string]$OutputDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $repoRoot "_installer_output"
}
if ([string]::IsNullOrWhiteSpace($PackageRoot)) {
  $PackageRoot = Join-Path $repoRoot "_package_root"
}

if (-not (Test-Path -LiteralPath $PackageRoot)) {
  throw "PackageRoot was not found. Pass -PackageRoot to the unpacked desktop build folder that contains 'Pixel Agents Desktop.exe' and 'resources\app\package.json'."
}

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Remove-PathIfExists {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

function Get-DirectorySizeKb {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    return 0
  }
  $sum = (Get-ChildItem -LiteralPath $Path -Recurse -File -Force | Measure-Object -Property Length -Sum).Sum
  if (-not $sum) {
    return 0
  }
  return [int][Math]::Ceiling($sum / 1KB)
}

function Copy-AllowedItem {
  param(
    [string]$SourceRoot,
    [string]$DestinationRoot,
    [string]$Name
  )

  $sourcePath = Join-Path $SourceRoot $Name
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Required runtime item not found: $sourcePath"
  }

  if ((Get-Item -LiteralPath $sourcePath).PSIsContainer) {
    Copy-Item -LiteralPath $sourcePath -Destination $DestinationRoot -Recurse -Force
    return
  }

  Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $DestinationRoot $Name) -Force
}

$packageJsonPath = Join-Path $PackageRoot "resources\app\package.json"
if (-not (Test-Path -LiteralPath $packageJsonPath)) {
  throw "Desktop package metadata not found: $packageJsonPath"
}

$packageMeta = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$productName = [string]$packageMeta.productName
$productVersion = [string]$packageMeta.version
if ([string]::IsNullOrWhiteSpace($productName)) {
  $productName = "Pixel Agents Desktop"
}
if ([string]::IsNullOrWhiteSpace($productVersion)) {
  $productVersion = "0.1.0"
}

$publisher = "Custom Local Build"
$stagingRoot = Join-Path $PackageRoot "_installer_build"
$payloadRoot = Join-Path $stagingRoot "payload"
$sedPath = Join-Path $stagingRoot "installer.sed"
$installScriptPath = Join-Path $stagingRoot "install.ps1"
$payloadZipPath = Join-Path $stagingRoot "app-package.zip"
$setupFileName = "{0} Setup {1}.exe" -f $productName, $productVersion
$setupOutputPath = Join-Path $OutputDir $setupFileName

$allowedTopLevelItems = @(
  "locales",
  "resources",
  "chrome_100_percent.pak",
  "chrome_200_percent.pak",
  "d3dcompiler_47.dll",
  "dxcompiler.dll",
  "dxil.dll",
  "ffmpeg.dll",
  "icudtl.dat",
  "libEGL.dll",
  "libGLESv2.dll",
  "LICENSE",
  "LICENSES.chromium.html",
  "Pixel Agents Desktop.exe",
  "resources.pak",
  "snapshot_blob.bin",
  "v8_context_snapshot.bin",
  "version",
  "vk_swiftshader.dll",
  "vk_swiftshader_icd.json",
  "vulkan-1.dll"
)

Remove-PathIfExists -Path $stagingRoot
Ensure-Directory -Path $stagingRoot
Ensure-Directory -Path $payloadRoot
Ensure-Directory -Path $OutputDir

foreach ($itemName in $allowedTopLevelItems) {
  Copy-AllowedItem -SourceRoot $PackageRoot -DestinationRoot $payloadRoot -Name $itemName
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $payloadZipPath) {
  Remove-Item -LiteralPath $payloadZipPath -Force
}
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $payloadRoot,
  $payloadZipPath,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)

$estimatedSizeKb = Get-DirectorySizeKb -Path $payloadRoot

$installScript = @'
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [string]$InstallDir,
  [switch]$NoLaunch,
  [switch]$NoShortcuts,
  [switch]$NoRegistry,
  [switch]$NoAutoStart
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

$appName = "__APP_NAME__"
$appVersion = "__APP_VERSION__"
$publisher = "__PUBLISHER__"
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelAgentsDesktop"
$defaultInstallDir = Join-Path (Join-Path $env:LOCALAPPDATA "Programs") $appName
$installDir = if ([string]::IsNullOrWhiteSpace($InstallDir)) { $defaultInstallDir } else { $InstallDir }
$packageZip = Join-Path $PSScriptRoot "app-package.zip"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "$appName.lnk"
$startupShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "$appName.lnk"
$startMenuRoot = Join-Path ([Environment]::GetFolderPath("Programs")) $appName
$appShortcut = Join-Path $startMenuRoot "$appName.lnk"
$uninstallShortcut = Join-Path $startMenuRoot "Удалить $appName.lnk"
$exePath = Join-Path $installDir "$appName.exe"
$uninstallPs1 = Join-Path $installDir "uninstall.ps1"
$uninstallCmd = Join-Path $installDir "uninstall.cmd"
$tempExtract = Join-Path $env:TEMP ("pixel-agents-installer-" + [Guid]::NewGuid().ToString("N"))

function Remove-PathIfExists {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function New-Shortcut {
  param(
    [string]$ShortcutPath,
    [string]$TargetPath,
    [string]$WorkingDirectory,
    [string]$Description
  )

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = $WorkingDirectory
  $shortcut.Description = $Description
  $shortcut.IconLocation = "$TargetPath,0"
  $shortcut.Save()
}

function Get-DirectorySizeKb {
  param([string]$Path)
  $sum = (Get-ChildItem -LiteralPath $Path -Recurse -File -Force | Measure-Object -Property Length -Sum).Sum
  if (-not $sum) {
    return 0
  }
  return [int][Math]::Ceiling($sum / 1KB)
}

if (-not (Test-Path -LiteralPath $packageZip)) {
  throw "Installer payload is missing: $packageZip"
}

Get-Process | Where-Object { $_.ProcessName -eq "Pixel Agents Desktop" } | Stop-Process -Force -ErrorAction SilentlyContinue

Remove-PathIfExists -Path $tempExtract
Ensure-Directory -Path $tempExtract
Remove-PathIfExists -Path $installDir
Ensure-Directory -Path $installDir

[System.IO.Compression.ZipFile]::ExtractToDirectory($packageZip, $tempExtract)
Get-ChildItem -LiteralPath $tempExtract -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $installDir -Recurse -Force
}

$uninstallScript = @"
Set-StrictMode -Version Latest
`$ErrorActionPreference = 'SilentlyContinue'
`$appName = '$appName'
`$installDir = `$PSScriptRoot
`$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) '`$appName.lnk'
`$startupShortcut = Join-Path ([Environment]::GetFolderPath('Startup')) '`$appName.lnk'
`$startMenuRoot = Join-Path ([Environment]::GetFolderPath('Programs')) '`$appName'
`$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PixelAgentsDesktop'

Get-Process | Where-Object { `$_.ProcessName -eq 'Pixel Agents Desktop' } | Stop-Process -Force -ErrorAction SilentlyContinue

if (Test-Path -LiteralPath `$desktopShortcut) { Remove-Item -LiteralPath `$desktopShortcut -Force }
if (Test-Path -LiteralPath `$startupShortcut) { Remove-Item -LiteralPath `$startupShortcut -Force }
if (Test-Path -LiteralPath `$startMenuRoot) { Remove-Item -LiteralPath `$startMenuRoot -Recurse -Force }
if (Test-Path -LiteralPath `$uninstallKey) { Remove-Item -LiteralPath `$uninstallKey -Recurse -Force }

`$cleanupCmd = Join-Path `$env:TEMP ('pixel-agents-uninstall-' + [Guid]::NewGuid().ToString('N') + '.cmd')
`$cmdBody = "@echo off`r`nchcp 65001>nul`r`nping 127.0.0.1 -n 3 >nul`r`nrmdir /s /q ""`$installDir""`r`ndel /f /q ""%~f0""`r`n"
Set-Content -LiteralPath `$cleanupCmd -Value `$cmdBody -Encoding ASCII
Start-Process -FilePath 'cmd.exe' -ArgumentList "/c `"`$cleanupCmd`"" -WindowStyle Hidden
"@

Set-Content -LiteralPath $uninstallPs1 -Value $uninstallScript -Encoding UTF8
Set-Content -LiteralPath $uninstallCmd -Encoding ASCII -Value "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%~dp0uninstall.ps1`"`r`n"

if (-not $NoShortcuts) {
  Ensure-Directory -Path $startMenuRoot
  New-Shortcut -ShortcutPath $desktopShortcut -TargetPath $exePath -WorkingDirectory $installDir -Description "Launch $appName"
  New-Shortcut -ShortcutPath $appShortcut -TargetPath $exePath -WorkingDirectory $installDir -Description "Launch $appName"
  New-Shortcut -ShortcutPath $uninstallShortcut -TargetPath $uninstallCmd -WorkingDirectory $installDir -Description "Uninstall $appName"
  if (-not $NoAutoStart) {
    New-Shortcut -ShortcutPath $startupShortcut -TargetPath $exePath -WorkingDirectory $installDir -Description "Launch $appName at sign-in"
  }
}

if (-not $NoRegistry) {
  $estimatedSizeKb = Get-DirectorySizeKb -Path $installDir
  New-Item -Path $uninstallKey -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "DisplayName" -Value $appName -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "DisplayVersion" -Value $appVersion -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "Publisher" -Value $publisher -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "InstallLocation" -Value $installDir -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "DisplayIcon" -Value $exePath -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "UninstallString" -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstallPs1`"" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "QuietUninstallString" -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstallPs1`"" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "NoModify" -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "NoRepair" -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -Path $uninstallKey -Name "EstimatedSize" -Value $estimatedSizeKb -PropertyType DWord -Force | Out-Null
}

Remove-PathIfExists -Path $tempExtract

if (-not $NoLaunch -and (Test-Path -LiteralPath $exePath)) {
  Start-Process -FilePath $exePath
}
'@

$installScript = $installScript.Replace("__APP_NAME__", $productName)
$installScript = $installScript.Replace("__APP_VERSION__", $productVersion)
$installScript = $installScript.Replace("__PUBLISHER__", $publisher)
Set-Content -LiteralPath $installScriptPath -Value $installScript -Encoding UTF8

$installPrompt = "Установить $productName на этот компьютер?"
$finishMessage = "Установка $productName завершена."
$friendlyName = "$productName Setup $productVersion"
$quietCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1 -NoLaunch"
$launchCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1"

$sedLines = @(
  "[Version]",
  "Class=IEXPRESS",
  "SEDVersion=3",
  "[Options]",
  "PackagePurpose=InstallApp",
  "ShowInstallProgramWindow=0",
  "HideExtractAnimation=1",
  "UseLongFileName=1",
  "InsideCompressed=1",
  "CAB_FixedSize=0",
  "CAB_ResvCodeSigning=0",
  "RebootMode=N",
  "InstallPrompt=%InstallPrompt%",
  "DisplayLicense=%DisplayLicense%",
  "FinishMessage=%FinishMessage%",
  "TargetName=%TargetName%",
  "FriendlyName=%FriendlyName%",
  "AppLaunched=%AppLaunched%",
  "PostInstallCmd=<None>",
  "AdminQuietInstCmd=%QuietCmd%",
  "UserQuietInstCmd=%QuietCmd%",
  "SourceFiles=SourceFiles",
  "[Strings]",
  "InstallPrompt=$installPrompt",
  "DisplayLicense=",
  "FinishMessage=$finishMessage",
  "TargetName=$setupOutputPath",
  "FriendlyName=$friendlyName",
  "AppLaunched=$launchCmd",
  "QuietCmd=$quietCmd",
  'FILE0="install.ps1"',
  'FILE1="app-package.zip"',
  "[SourceFiles]",
  ("SourceFiles0={0}\" -f $stagingRoot),
  "[SourceFiles0]",
  "%FILE0%=",
  "%FILE1%="
)
Set-Content -LiteralPath $sedPath -Value ($sedLines -join "`r`n") -Encoding Default

if (Test-Path -LiteralPath $setupOutputPath) {
  Remove-Item -LiteralPath $setupOutputPath -Force
}

$iexpress = "C:\Windows\System32\iexpress.exe"
if (-not (Test-Path -LiteralPath $iexpress)) {
  throw "IExpress is not available at $iexpress"
}

& $iexpress /N $sedPath

if (-not (Test-Path -LiteralPath $setupOutputPath)) {
  throw "Installer build did not produce the expected setup file: $setupOutputPath"
}

[pscustomobject]@{
  ProductName = $productName
  ProductVersion = $productVersion
  SetupPath = $setupOutputPath
  PayloadZip = $payloadZipPath
  PayloadSizeKb = $estimatedSizeKb
} | Format-List
