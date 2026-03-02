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
Source: "{#ReleaseRoot}\config\bootstrap.env"; DestDir: "{commonappdata}\ContainerTrackerAgent"; DestName: "bootstrap.env"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "{#ReleaseRoot}\config\bootstrap.env"; DestDir: "{tmp}"; DestName: "bootstrap.env.template"; Flags: dontcopy

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
var
  MaerskEnabled: Boolean;
  ChromeInstalled: Boolean;
  ChromePath: string;
  DependenciesPage: TWizardPage;
  ChromeDependencyCheckBox: TNewCheckBox;
  ChromeDependencyStatusLabel: TNewStaticText;

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

  ExtractTemporaryFile('bootstrap.env.template');
  TemplatePath := ExpandConstant('{tmp}\bootstrap.env.template');
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

function IsExistingFilePath(const CandidatePath: string; var ResolvedPath: string): Boolean;
var
  NormalizedPath: string;
begin
  NormalizedPath := Trim(CandidatePath);
  if NormalizedPath = '' then
  begin
    Result := False;
    exit;
  end;

  if (Length(NormalizedPath) >= 2) and (NormalizedPath[1] = '"') and
     (NormalizedPath[Length(NormalizedPath)] = '"') then
  begin
    NormalizedPath := Copy(NormalizedPath, 2, Length(NormalizedPath) - 2);
  end;

  Result := FileExists(NormalizedPath);
  if Result then
  begin
    ResolvedPath := NormalizedPath;
  end;
end;

function TryResolveDisplayIconPath(const DisplayIconValue: string; var ResolvedPath: string): Boolean;
var
  IconPath: string;
  CommaPos: Integer;
begin
  IconPath := Trim(DisplayIconValue);
  CommaPos := Pos(',', IconPath);
  if CommaPos > 0 then
  begin
    IconPath := Copy(IconPath, 1, CommaPos - 1);
  end;

  Result := IsExistingFilePath(IconPath, ResolvedPath);
end;

function TryFindFromAppPaths(const RootKey: Integer; const ExeName: string; var BrowserPath: string): Boolean;
var
  KeyPath: string;
  CandidatePath: string;
begin
  KeyPath := 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\' + ExeName;

  if RegQueryStringValue(RootKey, KeyPath, '', CandidatePath) and
     IsExistingFilePath(CandidatePath, BrowserPath) then
  begin
    Result := True;
    exit;
  end;

  if RegQueryStringValue(RootKey, KeyPath, 'Path', CandidatePath) then
  begin
    CandidatePath := AddBackslash(Trim(CandidatePath)) + ExeName;
    if IsExistingFilePath(CandidatePath, BrowserPath) then
    begin
      Result := True;
      exit;
    end;
  end;

  Result := False;
end;

function TryFindFromChromeUninstallKey(
  const RootKey: Integer;
  const SubKey: string;
  var BrowserPath: string
): Boolean;
var
  InstallLocation: string;
  DisplayIcon: string;
  CandidatePath: string;
begin
  if RegQueryStringValue(RootKey, SubKey, 'InstallLocation', InstallLocation) then
  begin
    CandidatePath := AddBackslash(Trim(InstallLocation)) + 'chrome.exe';
    if IsExistingFilePath(CandidatePath, BrowserPath) then
    begin
      Result := True;
      exit;
    end;

    CandidatePath := AddBackslash(Trim(InstallLocation)) + 'Application\chrome.exe';
    if IsExistingFilePath(CandidatePath, BrowserPath) then
    begin
      Result := True;
      exit;
    end;
  end;

  if RegQueryStringValue(RootKey, SubKey, 'DisplayIcon', DisplayIcon) and
     TryResolveDisplayIconPath(DisplayIcon, BrowserPath) then
  begin
    Result := True;
    exit;
  end;

  Result := False;
end;

function TryFindFromDefaultPaths(var BrowserPath: string): Boolean;
var
  CandidatePaths: array[0..5] of string;
  I: Integer;
begin
  CandidatePaths[0] := ExpandConstant('{pf}\Google\Chrome\Application\chrome.exe');
  CandidatePaths[1] := ExpandConstant('{pf32}\Google\Chrome\Application\chrome.exe');
  CandidatePaths[2] := ExpandConstant('{localappdata}\Google\Chrome\Application\chrome.exe');
  CandidatePaths[3] := ExpandConstant('{pf}\Chromium\Application\chrome.exe');
  CandidatePaths[4] := ExpandConstant('{pf32}\Chromium\Application\chrome.exe');
  CandidatePaths[5] := ExpandConstant('{localappdata}\Chromium\Application\chrome.exe');

  for I := 0 to 5 do
  begin
    if IsExistingFilePath(CandidatePaths[I], BrowserPath) then
    begin
      Result := True;
      exit;
    end;
  end;

  Result := False;
end;

function FindChromeExe(var BrowserPath: string): Boolean;
begin
  BrowserPath := '';

  if TryFindFromAppPaths(HKLM, 'chrome.exe', BrowserPath) then
  begin
    Result := True;
    exit;
  end;

  if TryFindFromAppPaths(HKCU, 'chrome.exe', BrowserPath) then
  begin
    Result := True;
    exit;
  end;

  if TryFindFromChromeUninstallKey(
    HKLM,
    'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Google Chrome',
    BrowserPath
  ) then
  begin
    Result := True;
    exit;
  end;

  if TryFindFromChromeUninstallKey(
    HKLM,
    'SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Google Chrome',
    BrowserPath
  ) then
  begin
    Result := True;
    exit;
  end;

  Result := TryFindFromDefaultPaths(BrowserPath);
end;

function InitializeSetup(): Boolean;
var
  EffectiveConfig: AnsiString;
begin
  Result := True;
  MaerskEnabled := False;
  ChromeInstalled := False;
  ChromePath := '';
  DependenciesPage := nil;
  ChromeDependencyCheckBox := nil;
  ChromeDependencyStatusLabel := nil;

  if not TryLoadEffectiveConfig(EffectiveConfig) then
  begin
    MsgBox(
      'Could not load effective config/bootstrap template to evaluate MAERSK_ENABLED.',
      mbCriticalError,
      MB_OK
    );
    Result := False;
    exit;
  end;

  if not IsMaerskEnabledInConfig(EffectiveConfig) then
  begin
    exit;
  end;

  MaerskEnabled := True;
  ChromeInstalled := FindChromeExe(ChromePath);
end;

procedure InitializeWizard();
var
  IntroLabel: TNewStaticText;
begin
  if not MaerskEnabled then
  begin
    exit;
  end;

  DependenciesPage := CreateCustomPage(
    wpWelcome,
    'Dependencias de runtime',
    'Valide as dependencias usadas pelo provedor MAERSK.'
  );

  IntroLabel := TNewStaticText.Create(DependenciesPage);
  IntroLabel.Parent := DependenciesPage.Surface;
  IntroLabel.Left := ScaleX(0);
  IntroLabel.Top := ScaleY(0);
  IntroLabel.Width := DependenciesPage.SurfaceWidth;
  IntroLabel.AutoSize := False;
  IntroLabel.WordWrap := True;
  IntroLabel.Caption :=
    'MAERSK_ENABLED=1 requer Chrome/Chromium para o scraping. ' +
    'Dependencias ja instaladas ficam marcadas automaticamente.';
  WizardForm.AdjustLabelHeight(IntroLabel);

  ChromeDependencyCheckBox := TNewCheckBox.Create(DependenciesPage);
  ChromeDependencyCheckBox.Parent := DependenciesPage.Surface;
  ChromeDependencyCheckBox.Left := ScaleX(0);
  ChromeDependencyCheckBox.Top := IntroLabel.Top + IntroLabel.Height + ScaleY(12);
  ChromeDependencyCheckBox.Width := DependenciesPage.SurfaceWidth;
  ChromeDependencyCheckBox.Caption := 'Chrome/Chromium (obrigatorio)';
  ChromeDependencyCheckBox.Checked := ChromeInstalled;
  ChromeDependencyCheckBox.Enabled := not ChromeInstalled;

  ChromeDependencyStatusLabel := TNewStaticText.Create(DependenciesPage);
  ChromeDependencyStatusLabel.Parent := DependenciesPage.Surface;
  ChromeDependencyStatusLabel.Left := ScaleX(20);
  ChromeDependencyStatusLabel.Top :=
    ChromeDependencyCheckBox.Top + ChromeDependencyCheckBox.Height + ScaleY(4);
  ChromeDependencyStatusLabel.Width := DependenciesPage.SurfaceWidth - ScaleX(20);
  ChromeDependencyStatusLabel.AutoSize := False;
  ChromeDependencyStatusLabel.WordWrap := True;

  if ChromeInstalled then
  begin
    ChromeDependencyStatusLabel.Caption := 'Status: instalado em ' + ChromePath + '.';
  end
  else
  begin
    ChromeDependencyStatusLabel.Caption :=
      'Status: nao encontrado. Marque para instalar automaticamente via winget (requer internet).';
  end;

  WizardForm.AdjustLabelHeight(ChromeDependencyStatusLabel);
end;

function RunCmdHidden(const Parameters: string; var ResultCode: Integer): Boolean;
begin
  Result := Exec('cmd.exe', Parameters, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function ShouldInstallChromeDependency(): Boolean;
begin
  Result :=
    MaerskEnabled and
    (not ChromeInstalled) and
    (ChromeDependencyCheckBox <> nil) and
    ChromeDependencyCheckBox.Checked;
end;

function InstallChromeDependency(var ErrorMessage: string): Boolean;
var
  ResultCode: Integer;
  CommandParams: string;
begin
  ResultCode := -1;
  CommandParams :=
    '/C winget install --id Google.Chrome --exact --source winget ' +
    '--accept-package-agreements --accept-source-agreements --silent --disable-interactivity';

  if (not RunCmdHidden(CommandParams, ResultCode)) or (ResultCode <> 0) then
  begin
    ErrorMessage :=
      'Automatic Chrome install failed (winget exit code ' + IntToStr(ResultCode) + '). ' +
      'Install Google Chrome or Chromium manually and run setup again.';
    Result := False;
    exit;
  end;

  if not FindChromeExe(ChromePath) then
  begin
    ErrorMessage :=
      'Chrome install command completed, but chrome.exe was not found. ' +
      'Install Google Chrome or Chromium manually and run setup again.';
    Result := False;
    exit;
  end;

  ChromeInstalled := True;
  Result := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if not MaerskEnabled then
  begin
    exit;
  end;

  if (DependenciesPage = nil) or (CurPageID <> DependenciesPage.ID) then
  begin
    exit;
  end;

  if ChromeInstalled then
  begin
    exit;
  end;

  if (ChromeDependencyCheckBox <> nil) and ChromeDependencyCheckBox.Checked then
  begin
    exit;
  end;

  MsgBox(
    'Chrome/Chromium nao foi encontrado. Marque a opcao para instalar automaticamente ' +
    'ou instale manualmente antes de continuar.',
    mbCriticalError,
    MB_OK
  );
  Result := False;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ErrorMessage: string;
begin
  Result := '';
  if not MaerskEnabled then
  begin
    exit;
  end;

  if ChromeInstalled then
  begin
    exit;
  end;

  if not ShouldInstallChromeDependency() then
  begin
    Result :=
      'Chrome/Chromium nao foi encontrado. Marque a instalacao automatica na pagina de dependencias ' +
      'ou instale manualmente antes de executar este setup.';
    exit;
  end;

  if InstallChromeDependency(ErrorMessage) then
  begin
    exit;
  end;

  Result := ErrorMessage;
end;

function ApplyProgramDataAcl(var ErrorMessage: string): Boolean;
var
  ProgramDataDir: string;
  ResultCode: Integer;
  CommandParams: string;
begin
  ProgramDataDir := ExpandConstant('{commonappdata}\ContainerTrackerAgent');

  CommandParams := '/C icacls "' + ProgramDataDir + '" /inheritance:r';
  if (not RunCmdHidden(CommandParams, ResultCode)) or (ResultCode <> 0) then
  begin
    ErrorMessage := 'Failed to disable inherited ACL on ProgramData folder.';
    Result := False;
    exit;
  end;

  CommandParams :=
    '/C icacls "' + ProgramDataDir + '" /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F"';
  if (not RunCmdHidden(CommandParams, ResultCode)) or (ResultCode <> 0) then
  begin
    ErrorMessage := 'Failed to grant required ACL for SYSTEM/Administrators.';
    Result := False;
    exit;
  end;

  CommandParams :=
    '/C icacls "' + ProgramDataDir + '" /remove:g "Users" "Authenticated Users" "Everyone"';
  if (not RunCmdHidden(CommandParams, ResultCode)) or (ResultCode <> 0) then
  begin
    ErrorMessage := 'Failed to remove broad read ACL entries from ProgramData folder.';
    Result := False;
    exit;
  end;

  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ErrorMessage: string;
begin
  if CurStep <> ssPostInstall then
  begin
    exit;
  end;

  if ApplyProgramDataAcl(ErrorMessage) then
  begin
    exit;
  end;

  MsgBox(
    'ProgramData ACL hardening failed: ' + ErrorMessage + #13#10 +
    'Installation has been aborted to avoid exposing secrets.',
    mbCriticalError,
    MB_OK
  );
  Abort;
end;
