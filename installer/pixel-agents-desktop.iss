#ifndef MyAppName
  #define MyAppName "Pixel Agents Desktop"
#endif

#ifndef MyAppVersion
  #define MyAppVersion "0.1.2"
#endif

#ifndef MyAppPublisher
  #define MyAppPublisher "Pixel Agents Desktop"
#endif

#ifndef MySourceRoot
  #error MySourceRoot is not defined.
#endif

#ifndef MyOutputDir
  #error MyOutputDir is not defined.
#endif

#ifndef MyOutputBaseFilename
  #define MyOutputBaseFilename "Pixel Agents Desktop Setup"
#endif

#ifndef MySetupIconFile
  #define MySetupIconFile ""
#endif

[Setup]
AppId={{4F7F8AF4-6BB8-44E3-96A9-5EA0B47A6B1C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
UsePreviousAppDir=no
OutputDir={#MyOutputDir}
OutputBaseFilename={#MyOutputBaseFilename}
UninstallDisplayIcon={app}\Pixel Agents Desktop.exe
CloseApplications=yes
CloseApplicationsFilter=Pixel Agents Desktop.exe
RestartApplications=no
SetupLogging=yes
LicenseFile={#MySourceRoot}\LICENSE
#if MySetupIconFile != ""
SetupIconFile={#MySetupIconFile}
#endif

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "autostart"; Description: "Start with Windows"; GroupDescription: "Additional tasks:"

[Files]
Source: "{#MySourceRoot}\locales\*"; DestDir: "{app}\locales"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceRoot}\resources\*"; DestDir: "{app}\resources"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceRoot}\chrome_100_percent.pak"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\chrome_200_percent.pak"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\d3dcompiler_47.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\dxcompiler.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\dxil.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\ffmpeg.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\icudtl.dat"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\libEGL.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\libGLESv2.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\LICENSES.chromium.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\Pixel Agents Desktop.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\resources.pak"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\snapshot_blob.bin"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\v8_context_snapshot.bin"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\version"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\vk_swiftshader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\vk_swiftshader_icd.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\vulkan-1.dll"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\Pixel Agents Desktop.exe"; WorkingDir: "{app}"
Name: "{autoprograms}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\Pixel Agents Desktop.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\Pixel Agents Desktop.exe"; WorkingDir: "{app}"; Tasks: autostart

[Run]
Filename: "{app}\Pixel Agents Desktop.exe"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
