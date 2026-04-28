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

function Resolve-IsccPath {
  $candidates = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw "ISCC.exe was not found. Please install Inno Setup 6 first."
}

function New-InstallerIcon {
  param(
    [string]$ExePath,
    [string]$IcoPath
  )

  Add-Type -AssemblyName System.Drawing
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($ExePath)
  if (-not $icon) {
    throw "Could not extract icon from $ExePath"
  }

  $stream = [System.IO.File]::Open($IcoPath, [System.IO.FileMode]::Create)
  try {
    $icon.Save($stream)
  } finally {
    $stream.Dispose()
    $icon.Dispose()
  }
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

$publisher = "Pixel Agents Desktop"
$issPath = Join-Path $PackageRoot "_installer\pixel-agents-desktop.iss"
$iconPath = Join-Path $PackageRoot "_installer\pixel-agents-desktop.ico"
$exePath = Join-Path $PackageRoot "Pixel Agents Desktop.exe"
$setupBaseName = "{0} Setup {1}" -f $productName, $productVersion

if (-not (Test-Path -LiteralPath $issPath)) {
  throw "Inno Setup script not found: $issPath"
}
if (-not (Test-Path -LiteralPath $exePath)) {
  throw "Desktop executable not found: $exePath"
}

Ensure-Directory -Path $OutputDir
New-InstallerIcon -ExePath $exePath -IcoPath $iconPath

$isccPath = Resolve-IsccPath
$setupPath = Join-Path $OutputDir ($setupBaseName + ".exe")
if (Test-Path -LiteralPath $setupPath) {
  Remove-Item -LiteralPath $setupPath -Force
}
$arguments = @(
  "/Qp",
  "/DMyAppName=$productName",
  "/DMyAppVersion=$productVersion",
  "/DMyAppPublisher=$publisher",
  "/DMySourceRoot=$PackageRoot",
  "/DMyOutputDir=$OutputDir",
  "/DMyOutputBaseFilename=$setupBaseName",
  "/DMySetupIconFile=$iconPath",
  $issPath
)

& $isccPath $arguments
$isccExitCode = $LASTEXITCODE
if ($isccExitCode -ne 0) {
  throw "ISCC.exe failed with exit code $isccExitCode."
}

if (-not (Test-Path -LiteralPath $setupPath)) {
  throw "Inno Setup did not produce the expected installer: $setupPath"
}

[pscustomobject]@{
  ProductName = $productName
  ProductVersion = $productVersion
  ISCC = $isccPath
  SetupPath = $setupPath
  SetupIcon = $iconPath
} | Format-List
