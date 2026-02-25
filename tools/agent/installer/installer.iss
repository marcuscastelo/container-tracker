#define AppName "Container Tracker Agent"
#define AppVersion "0.1.0"
#define AppDirName "ContainerTrackerAgent"
#define ServiceId "ContainerTrackerAgent"
#define UpdaterTaskName "ContainerTrackerAgentUpdater"
#define RepoRoot "..\..\.."
#define ReleaseRoot RepoRoot + "\release"

[Setup]
AppId={{0F1AE8D1-7B19-4B14-9A17-2EF197BBD5AA}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\{#AppDirName}
DisableDirPage=yes
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
OutputBaseFilename=ContainerTrackerAgent-Setup
Compression=lzma
SolidCompression=yes

[Dirs]
Name: "{commonappdata}\ContainerTrackerAgent"
Name: "{commonappdata}\ContainerTrackerAgent\logs"

[Files]
Source: "{#ReleaseRoot}\node\*"; DestDir: "{app}\node"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#ReleaseRoot}\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#ReleaseRoot}\winsw\*"; DestDir: "{app}\winsw"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#ReleaseRoot}\config\config.env"; DestDir: "{commonappdata}\ContainerTrackerAgent"; DestName: "config.env"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "{#ReleaseRoot}\config\config.env"; DestDir: "{tmp}"; DestName: "config.env.template"; Flags: dontcopy

[Run]
Filename: "{app}\winsw\ContainerTrackerAgent.exe"; Parameters: "install"; Flags: runhidden waituntilterminated
Filename: "{app}\winsw\ContainerTrackerAgent.exe"; Parameters: "start"; Flags: runhidden waituntilterminated
; Canonical updater command (preflight): cmd /c ""{app}\node\node.exe" "{app}\app\dist\updater.js""
Filename: "schtasks.exe"; Parameters: "/Create /F /SC MINUTE /MO 30 /TN ""{#UpdaterTaskName}"" /RU SYSTEM /TR ""cmd /c """"{app}\node\node.exe"" ""{app}\app\dist\updater.js"""""""; Flags: runhidden waituntilterminated

[UninstallRun]
Filename: "cmd.exe"; Parameters: "/C schtasks /Delete /TN ""{#UpdaterTaskName}"" /F >NUL 2>&1 || exit /B 0"; Flags: runhidden waituntilterminated
Filename: "cmd.exe"; Parameters: "/C ""{app}\winsw\ContainerTrackerAgent.exe"" stop >NUL 2>&1 || exit /B 0"; Flags: runhidden waituntilterminated
Filename: "cmd.exe"; Parameters: "/C ""{app}\winsw\ContainerTrackerAgent.exe"" uninstall >NUL 2>&1 || exit /B 0"; Flags: runhidden waituntilterminated

[Code]
function NormalizeNewLines(const Value: AnsiString): AnsiString;
var
  I: Integer;
begin
  Result := '';
  for I := 1 to Length(Value) do
  begin
    if Value[I] <> #13 then
      Result := Result + Value[I];
  end;
end;

function ContainsLine(const Content: AnsiString; const LineValue: string): Boolean;
var
  NormalizedContent: AnsiString;
begin
  NormalizedContent := #10 + NormalizeNewLines(Content) + #10;
  Result := Pos(#10 + LineValue + #10, NormalizedContent) > 0;
end;

function TryLoadEffectiveConfig(var Content: AnsiString): Boolean;
var
  ExistingConfigPath: string;
  TemplatePath: string;
begin
  ExistingConfigPath := ExpandConstant('{commonappdata}\ContainerTrackerAgent\config.env');
  if LoadStringFromFile(ExistingConfigPath, Content) then
  begin
    Result := True;
    exit;
  end;

  ExtractTemporaryFile('config.env.template');
  TemplatePath := ExpandConstant('{tmp}\config.env.template');
  Result := LoadStringFromFile(TemplatePath, Content);
end;

function IsMaerskEnabledInConfig(const Content: AnsiString): Boolean;
var
  Normalized: AnsiString;
begin
  Normalized := NormalizeNewLines(Content);
  Result := ContainsLine(Normalized, 'MAERSK_ENABLED=1');
  if Result then exit;

  Result := Pos('MAERSK_ENABLED=1', Normalized) > 0;
end;

function IsChromeInstalled: Boolean;
var
  ProgramFiles64: string;
  ProgramFiles32: string;
begin
  ProgramFiles64 := ExpandConstant('{pf}');
  ProgramFiles32 := ExpandConstant('{pf32}');

  Result :=
    FileExists(ProgramFiles64 + '\Google\Chrome\Application\chrome.exe') or
    FileExists(ProgramFiles32 + '\Google\Chrome\Application\chrome.exe') or
    FileExists(ProgramFiles64 + '\Chromium\Application\chrome.exe') or
    FileExists(ProgramFiles32 + '\Chromium\Application\chrome.exe');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  EffectiveConfig: AnsiString;
begin
  Result := True;
  if CurPageID <> wpReady then
  begin
    exit;
  end;

  if not TryLoadEffectiveConfig(EffectiveConfig) then
  begin
    MsgBox('Could not load effective config.env to evaluate MAERSK_ENABLED.', mbCriticalError, MB_OK);
    Result := False;
    exit;
  end;

  if not IsMaerskEnabledInConfig(EffectiveConfig) then
  begin
    MsgBox(
      'MAERSK_ENABLED is disabled. Chrome pre-check skipped and installation will continue.',
      mbInformation,
      MB_OK
    );
    exit;
  end;

  if IsChromeInstalled then
  begin
    exit;
  end;

  MsgBox(
    'MAERSK_ENABLED=1 but Chrome/Chromium was not found. Install Chrome/Chromium and run setup again.',
    mbCriticalError,
    MB_OK
  );
  Result := False;
end;
