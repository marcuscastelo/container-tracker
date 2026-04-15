#define AppName "Container Tracker Agent"
#define AppVersion "0.1.0"
#define AppIdValue "{{0F1AE8D1-7B19-4B14-9A17-2EF197BBD5AA}}"
#define AppDirName "ContainerTrackerAgent"
#define AgentTaskName "ContainerTrackerAgent"
#define UpdaterTaskName "ContainerTrackerAgentUpdater"
#define RepoRoot "..\..\.."
#define ReleaseRoot RepoRoot + "\release"

[Setup]
AppId={#AppIdValue}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\{#AppDirName}
DisableDirPage=yes
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
OutputBaseFilename=ContainerTrackerAgent-Setup
Compression=lzma
SolidCompression=yes
SetupLogging=yes
UninstallLogging=yes

[Dirs]
Name: "{localappdata}\ContainerTracker"; BeforeInstall: LogDirectoryCreation('{localappdata}\ContainerTracker')
Name: "{localappdata}\ContainerTracker\releases"; BeforeInstall: LogDirectoryCreation('{localappdata}\ContainerTracker\releases')
Name: "{localappdata}\ContainerTracker\logs"; BeforeInstall: LogDirectoryCreation('{localappdata}\ContainerTracker\logs')
Name: "{localappdata}\ContainerTracker\downloads"; BeforeInstall: LogDirectoryCreation('{localappdata}\ContainerTracker\downloads')
Name: "{localappdata}\ContainerTracker\run"; BeforeInstall: LogDirectoryCreation('{localappdata}\ContainerTracker\run')

[Files]
Source: "{#ReleaseRoot}\node\*"; DestDir: "{app}\node"; Flags: recursesubdirs createallsubdirs ignoreversion; BeforeInstall: LogNodeRuntimeCopyStart
Source: "{#ReleaseRoot}\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs createallsubdirs ignoreversion; BeforeInstall: LogAppBundleCopyStart
Source: "run-supervisor.ps1"; DestDir: "{app}\app\dist"; Flags: ignoreversion; BeforeInstall: LogFileCopy('run-supervisor.ps1', '{app}\app\dist\run-supervisor.ps1')
Source: "agent-tray-host.ps1"; DestDir: "{app}\app\dist"; Flags: ignoreversion; BeforeInstall: LogFileCopy('agent-tray-host.ps1', '{app}\app\dist\agent-tray-host.ps1')
Source: "updater-hidden.ps1"; DestDir: "{app}\app\dist"; Flags: ignoreversion; BeforeInstall: LogFileCopy('updater-hidden.ps1', '{app}\app\dist\updater-hidden.ps1')
Source: "stop-agent-runtime.ps1"; DestDir: "{app}\app\dist"; Flags: ignoreversion; BeforeInstall: LogFileCopy('stop-agent-runtime.ps1', '{app}\app\dist\stop-agent-runtime.ps1')
Source: "resources\tray.ico"; DestDir: "{app}\app\assets"; Flags: ignoreversion; BeforeInstall: LogFileCopy('tray icon', '{app}\app\assets\tray.ico')
Source: "{#ReleaseRoot}\config\bootstrap.env"; DestDir: "{localappdata}\ContainerTracker"; DestName: "bootstrap.env"; Flags: uninsneveruninstall; BeforeInstall: LogFileCopy('bootstrap.env', '{localappdata}\ContainerTracker\bootstrap.env')
Source: "{#ReleaseRoot}\config\bootstrap.env"; DestDir: "{tmp}"; DestName: "bootstrap.env.template"; Flags: dontcopy; BeforeInstall: LogFileCopy('bootstrap.env template', '{tmp}\bootstrap.env.template')
Source: "stop-agent-runtime.ps1"; DestDir: "{tmp}"; Flags: dontcopy; BeforeInstall: LogFileCopy('stop-agent-runtime.ps1 (temp)', '{tmp}\stop-agent-runtime.ps1')

[Run]
Filename: "cmd.exe"; Parameters: "/C powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$taskName = '{#AgentTaskName}'; $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/d /s /c powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"{app}\app\dist\run-supervisor.ps1""""'; $trigger = New-ScheduledTaskTrigger -AtLogOn; $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries; $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited; Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue; Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null"""; Flags: runhidden waituntilterminated logoutput; BeforeInstall: LogRunAction('Registering scheduled task {#AgentTaskName}.')
Filename: "cmd.exe"; Parameters: "/C powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$taskName = '{#UpdaterTaskName}'; $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/d /s /c powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """"{app}\app\dist\updater-hidden.ps1""""'; $trigger = New-ScheduledTaskTrigger -AtLogOn; $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries; $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited; Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue; Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null"""; Flags: runhidden waituntilterminated logoutput; BeforeInstall: LogRunAction('Registering scheduled task {#UpdaterTaskName}.')
Filename: "cmd.exe"; Parameters: "/C timeout /T 8 /NOBREAK >NUL & start """" /B powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\app\dist\run-supervisor.ps1"""; Flags: runhidden waituntilterminated logoutput; BeforeInstall: LogRunAction('Starting agent supervisor process.')
Filename: "cmd.exe"; Parameters: "/C timeout /T 8 /NOBREAK >NUL & start """" /B powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\app\dist\updater-hidden.ps1"""; Flags: runhidden waituntilterminated logoutput; BeforeInstall: LogRunAction('Starting updater runtime process.')

[UninstallRun]
Filename: "cmd.exe"; Parameters: "/C schtasks /Change /TN ""{#AgentTaskName}"" /DISABLE || exit /B 0"; Flags: runhidden waituntilterminated logoutput; StatusMsg: "Disabling scheduled task {#AgentTaskName}..."; RunOnceId: "disable-agent-task"
Filename: "cmd.exe"; Parameters: "/C schtasks /Change /TN ""{#UpdaterTaskName}"" /DISABLE || exit /B 0"; Flags: runhidden waituntilterminated logoutput; StatusMsg: "Disabling scheduled task {#UpdaterTaskName}..."; RunOnceId: "disable-updater-task"
Filename: "cmd.exe"; Parameters: "/C schtasks /End /TN ""{#AgentTaskName}"" || exit /B 0"; Flags: runhidden waituntilterminated logoutput; StatusMsg: "Stopping scheduled task {#AgentTaskName}..."; RunOnceId: "end-agent-task"
Filename: "cmd.exe"; Parameters: "/C schtasks /End /TN ""{#UpdaterTaskName}"" || exit /B 0"; Flags: runhidden waituntilterminated logoutput; StatusMsg: "Stopping scheduled task {#UpdaterTaskName}..."; RunOnceId: "end-updater-task"
Filename: "cmd.exe"; Parameters: "/C powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\app\dist\stop-agent-runtime.ps1"" -CleanupNodeModules || exit /B 0"; Flags: runhidden waituntilterminated logoutput; StatusMsg: "Stopping agent runtime processes..."; RunOnceId: "kill-agent-runtime-processes"
Filename: "cmd.exe"; Parameters: "/C timeout /T 5 /NOBREAK || exit /B 0"; Flags: runhidden waituntilterminated logoutput; StatusMsg: "Waiting for process shutdown..."; RunOnceId: "post-kill-runtime-delay"
Filename: "cmd.exe"; Parameters: "/C schtasks /Delete /TN ""{#AgentTaskName}"" /F || exit /B 0"; Flags: runhidden waituntilterminated logoutput; StatusMsg: "Deleting scheduled task {#AgentTaskName}..."; RunOnceId: "delete-agent-task"
Filename: "cmd.exe"; Parameters: "/C schtasks /Delete /TN ""{#UpdaterTaskName}"" /F || exit /B 0"; Flags: runhidden waituntilterminated logoutput; StatusMsg: "Deleting scheduled task {#UpdaterTaskName}..."; RunOnceId: "delete-updater-task"

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\ContainerTracker\*"
Type: dirifempty; Name: "{localappdata}\ContainerTracker"
Type: filesandordirs; Name: "{localappdata}\Programs\ContainerTrackerAgent\*"
Type: dirifempty; Name: "{localappdata}\Programs\ContainerTrackerAgent"

[Code]
const
  InstallLogMaxLines = 600;
  InstallLogBottomPadding = 8;
  InstallLogMinHeight = 120;
  UninstallCleanupLogPathConstant = '{localappdata}\ContainerTracker\logs\uninstall-cleanup.log';
  UninstallerRunLogPathConstant = '{localappdata}\ContainerTracker\logs\uninstaller-run.log';
  UninstallerDeferredStartSeconds = 2;

var
  AgentInstalled: Boolean;
  InstalledUninstallerPath: string;
  ActionSelectionPage: TWizardPage;
  UninstallProgressPage: TWizardPage;
  InstallActionRadio: TNewRadioButton;
  UninstallActionRadio: TNewRadioButton;
  MaerskEnabled: Boolean;
  ChromeInstalled: Boolean;
  ChromePath: string;
  DependenciesPage: TWizardPage;
  ChromeDependencyCheckBox: TNewCheckBox;
  ChromeDependencyStatusLabel: TNewStaticText;
  InstallLogMemo: TMemo;
  InstallLogLabel: TNewStaticText;
  UninstallProgressLogMemo: TMemo;
  NodeRuntimeCopyStarted: Boolean;
  AppBundleCopyStarted: Boolean;
  CloseWithoutIncompleteWarning: Boolean;

procedure CreateUninstallProgressPage(); forward;
function IsUninstallActionSelected(): Boolean; forward;
procedure CloseSetupWithoutIncompleteWarning(); forward;

procedure AppendMemoLogLine(const TargetMemo: TMemo; const Msg: string);
begin
  if TargetMemo = nil then
  begin
    exit;
  end;

  TargetMemo.Lines.Add(Msg);
  while TargetMemo.Lines.Count > InstallLogMaxLines do
  begin
    TargetMemo.Lines.Delete(0);
  end;

  TargetMemo.SelStart := Length(TargetMemo.Text);
  TargetMemo.SelLength := 0;
end;

procedure AppendUILogLine(const Msg: string);
var
  HasVisibleMemo: Boolean;
begin
  HasVisibleMemo := (InstallLogMemo <> nil) or (UninstallProgressLogMemo <> nil);
  AppendMemoLogLine(InstallLogMemo, Msg);
  AppendMemoLogLine(UninstallProgressLogMemo, Msg);

  if HasVisibleMemo and (WizardForm <> nil) then
  begin
    WizardForm.Update;
  end;
end;

procedure UILog(const Msg: String);
begin
  Log(Msg);
  AppendUILogLine(Msg);
end;

procedure UIErrorLog(const Msg: String);
begin
  UILog('ERROR: ' + Msg);
end;

function EscapePowerShellSingleQuotedValue(const Value: string): string;
begin
  Result := Value;
  StringChangeEx(Result, '''', '''''', True);
end;

function LaunchDeferredInstalledUninstaller(
  const UninstallerPath: string;
  const UninstallerParams: string;
  var SpawnResultCode: Integer
): Boolean;
var
  DeferredCommand: string;
  EscapedUninstallerPath: string;
  EscapedUninstallerParams: string;
begin
  SpawnResultCode := -1;
  EscapedUninstallerPath := EscapePowerShellSingleQuotedValue(UninstallerPath);
  EscapedUninstallerParams := EscapePowerShellSingleQuotedValue(UninstallerParams);
  DeferredCommand :=
    'Start-Sleep -Seconds ' + IntToStr(UninstallerDeferredStartSeconds) + '; ' +
    'Start-Process -FilePath ''' + EscapedUninstallerPath + ''' -ArgumentList ''' +
    EscapedUninstallerParams + '''';
  UILog('Scheduling deferred uninstaller command via PowerShell.');
  Result := Exec(
    'powershell.exe',
    '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "' + DeferredCommand + '"',
    '',
    SW_HIDE,
    ewNoWait,
    SpawnResultCode
  );
end;

procedure CreateInstallingLogPanel();
var
  MemoTop: Integer;
begin
  InstallLogLabel := TNewStaticText.Create(WizardForm);
  InstallLogLabel.Parent := WizardForm.InstallingPage;
  InstallLogLabel.Left := WizardForm.StatusLabel.Left;
  InstallLogLabel.Top :=
    WizardForm.ProgressGauge.Top + WizardForm.ProgressGauge.Height + ScaleY(14);
  InstallLogLabel.Width := WizardForm.ProgressGauge.Width;
  InstallLogLabel.AutoSize := False;
  InstallLogLabel.WordWrap := True;
  InstallLogLabel.Caption := 'Operational log (real time)';
  WizardForm.AdjustLabelHeight(InstallLogLabel);

  MemoTop := InstallLogLabel.Top + InstallLogLabel.Height + ScaleY(4);

  InstallLogMemo := TMemo.Create(WizardForm);
  InstallLogMemo.Parent := WizardForm.InstallingPage;
  InstallLogMemo.Left := WizardForm.StatusLabel.Left;
  InstallLogMemo.Top := MemoTop;
  InstallLogMemo.Width := WizardForm.ProgressGauge.Width;
  InstallLogMemo.Height :=
    WizardForm.InstallingPage.Height - InstallLogMemo.Top - ScaleY(InstallLogBottomPadding);
  if InstallLogMemo.Height < ScaleY(InstallLogMinHeight) then
  begin
    InstallLogMemo.Height := ScaleY(InstallLogMinHeight);
  end;
  InstallLogMemo.ReadOnly := True;
  InstallLogMemo.ScrollBars := ssVertical;
  InstallLogMemo.WordWrap := False;
  InstallLogMemo.TabStop := False;
end;

procedure LogDirectoryCreation(const DirectoryConstant: string);
begin
  UILog('Ensuring directory exists: ' + ExpandConstant(DirectoryConstant));
end;

procedure LogNodeRuntimeCopyStart();
begin
  if NodeRuntimeCopyStarted then
  begin
    exit;
  end;

  NodeRuntimeCopyStarted := True;
  UILog('Copying Node runtime files to ' + ExpandConstant('{app}\node') + '.');
end;

procedure LogAppBundleCopyStart();
begin
  if AppBundleCopyStarted then
  begin
    exit;
  end;

  AppBundleCopyStarted := True;
  UILog('Copying agent app files to ' + ExpandConstant('{app}\app') + '.');
end;

procedure LogFileCopy(const FileDescription: string; const DestinationPathConstant: string);
begin
  UILog(
    'Copying ' + FileDescription + ' to ' + ExpandConstant(DestinationPathConstant) + '.'
  );
end;

procedure LogRunAction(const ActionMessage: string);
begin
  UILog(ActionMessage);
end;

procedure OnExternalCommandLog(const S: String; const Error, FirstLine: Boolean);
begin
  if Error then
  begin
    UILog('cmd:error> ' + S);
    exit;
  end;

  UILog('cmd> ' + S);
end;

function RunCmdAndLogOutput(
  const StepName: string;
  const Parameters: string;
  var ResultCode: Integer
): Boolean;
begin
  ResultCode := -1;
  UILog('Starting command: ' + StepName);
  UILog('Command line: cmd.exe ' + Parameters);

  try
    Result := ExecAndLogOutput(
      'cmd.exe',
      Parameters,
      '',
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode,
      @OnExternalCommandLog
    );
  except
    UIErrorLog(
      'Failed to set up command output capture for "' + StepName + '": ' + GetExceptionMessage
    );
    Result := False;
    exit;
  end;

  if not Result then
  begin
    UIErrorLog('Failed to launch command "' + StepName + '".');
    exit;
  end;

  UILog(
    'Command completed: ' + StepName + ' (exit code ' + IntToStr(ResultCode) + ').'
  );
end;

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

function TryGetEnvVarValue(const Content: AnsiString; const Key: string; var Value: string): Boolean;
var
  Normalized: AnsiString;
  Line: string;
  LineStart: Integer;
  LineEndOffset: Integer;
  EqPos: Integer;
  RawKey: string;
  RawValue: string;
begin
  Result := False;
  Value := '';
  Normalized := NormalizeNewLines(Content);
  LineStart := 1;

  while LineStart <= Length(Normalized) do
  begin
    LineEndOffset := Pos(#10, Copy(Normalized, LineStart, MaxInt));
    if LineEndOffset = 0 then
    begin
      Line := Copy(Normalized, LineStart, MaxInt);
      LineStart := Length(Normalized) + 1;
    end
    else
    begin
      Line := Copy(Normalized, LineStart, LineEndOffset - 1);
      LineStart := LineStart + LineEndOffset;
    end;

    Line := Trim(Line);
    if (Line = '') then
      continue;

    if (Line[1] = '#') or (Line[1] = ';') then
      continue;

    EqPos := Pos('=', Line);
    if EqPos <= 1 then
      continue;

    RawKey := Trim(Copy(Line, 1, EqPos - 1));
    if CompareText(RawKey, Key) <> 0 then
      continue;

    RawValue := Trim(Copy(Line, EqPos + 1, MaxInt));
    if (Length(RawValue) >= 2) and (
      ((RawValue[1] = '"') and (RawValue[Length(RawValue)] = '"')) or
      ((RawValue[1] = '''') and (RawValue[Length(RawValue)] = ''''))
    ) then
    begin
      RawValue := Copy(RawValue, 2, Length(RawValue) - 2);
    end;

    Value := RawValue;
    Result := True;
    exit;
  end;
end;

function TryLoadEffectiveConfig(var Content: AnsiString): Boolean;
var
  ExistingConfigPath: string;
  TemplatePath: string;
begin
  ExistingConfigPath := ExpandConstant('{localappdata}\ContainerTracker\config.env');
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
  RawValue: string;
  NormalizedValue: string;
begin
  if not TryGetEnvVarValue(Content, 'MAERSK_ENABLED', RawValue) then
  begin
    Result := False;
    exit;
  end;

  NormalizedValue := Lowercase(Trim(RawValue));
  Result := (NormalizedValue = '1') or (NormalizedValue = 'true');
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

function TryExtractExecutablePathFromCommand(
  const CommandValue: string;
  var ExecutablePath: string
): Boolean;
var
  NormalizedCommand: string;
  ClosingQuotePos: Integer;
  FirstSpacePos: Integer;
begin
  NormalizedCommand := Trim(CommandValue);
  if NormalizedCommand = '' then
  begin
    Result := False;
    exit;
  end;

  if NormalizedCommand[1] = '"' then
  begin
    Delete(NormalizedCommand, 1, 1);
    ClosingQuotePos := Pos('"', NormalizedCommand);
    if ClosingQuotePos > 0 then
    begin
      NormalizedCommand := Copy(NormalizedCommand, 1, ClosingQuotePos - 1);
    end
    else
    begin
      NormalizedCommand := '';
    end;
  end
  else
  begin
    FirstSpacePos := Pos(' ', NormalizedCommand);
    if FirstSpacePos > 0 then
    begin
      NormalizedCommand := Copy(NormalizedCommand, 1, FirstSpacePos - 1);
    end;
  end;

  Result := IsExistingFilePath(NormalizedCommand, ExecutablePath);
end;

function TryReadUninstallString(
  const RootKey: Integer;
  const SubKey: string;
  var UninstallCommand: string
): Boolean;
begin
  if RegQueryStringValue(RootKey, SubKey, 'QuietUninstallString', UninstallCommand) then
  begin
    Result := True;
    exit;
  end;

  Result := RegQueryStringValue(RootKey, SubKey, 'UninstallString', UninstallCommand);
end;

function NormalizeAppIdForRegistry(const AppId: string): string;
begin
  Result := AppId;
  StringChangeEx(Result, '{{', '{', True);
  StringChangeEx(Result, '}}', '}', True);
end;

function TryReadUninstallStringFromAppId(
  const AppId: string;
  var UninstallCommand: string
): Boolean;
var
  UninstallKeyPath: string;
begin
  UninstallKeyPath := 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\' + AppId + '_is1';

  Result :=
    TryReadUninstallString(HKCU64, UninstallKeyPath, UninstallCommand) or
    TryReadUninstallString(HKCU32, UninstallKeyPath, UninstallCommand) or
    TryReadUninstallString(HKCU, UninstallKeyPath, UninstallCommand);
end;

function TryFindUninstallerInLocalAppData(var UninstallerPath: string): Boolean;
var
  InstallDir: string;
  CandidatePath: string;
  I: Integer;
begin
  InstallDir := ExpandConstant('{localappdata}\Programs\{#AppDirName}');

  for I := 0 to 9 do
  begin
    CandidatePath := AddBackslash(InstallDir) + Format('unins%.3d.exe', [I]);
    if IsExistingFilePath(CandidatePath, UninstallerPath) then
    begin
      Result := True;
      exit;
    end;
  end;

  Result := False;
end;

function TryFindInstalledUninstaller(var UninstallerPath: string): Boolean;
var
  RawAppId: string;
  NormalizedAppId: string;
  UninstallCommand: string;
begin
  UninstallerPath := '';
  UninstallCommand := '';
  RawAppId := '{#AppIdValue}';
  NormalizedAppId := NormalizeAppIdForRegistry(RawAppId);

  if TryReadUninstallStringFromAppId(NormalizedAppId, UninstallCommand) and
     TryExtractExecutablePathFromCommand(UninstallCommand, UninstallerPath) then
  begin
    Result := True;
    exit;
  end;

  if (CompareText(RawAppId, NormalizedAppId) <> 0) and
     TryReadUninstallStringFromAppId(RawAppId, UninstallCommand) and
     TryExtractExecutablePathFromCommand(UninstallCommand, UninstallerPath) then
  begin
    Result := True;
    exit;
  end;

  Result := TryFindUninstallerInLocalAppData(UninstallerPath);
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
  CandidatePaths: array[0..7] of string;
  I: Integer;
begin
  CandidatePaths[0] := ExpandConstant('{localappdata}\Google\Chrome\Application\chrome.exe');
  CandidatePaths[1] := ExpandConstant('{localappdata}\Chromium\Application\chrome.exe');
  CandidatePaths[2] := ExpandConstant('{commonpf}\Google\Chrome\Application\chrome.exe');
  CandidatePaths[3] := ExpandConstant('{commonpf}\Chromium\Application\chrome.exe');
  CandidatePaths[4] := ExpandConstant('{commonpf32}\Google\Chrome\Application\chrome.exe');
  CandidatePaths[5] := ExpandConstant('{commonpf32}\Chromium\Application\chrome.exe');
  CandidatePaths[6] := ExpandConstant('{commonpf64}\Google\Chrome\Application\chrome.exe');
  CandidatePaths[7] := ExpandConstant('{commonpf64}\Chromium\Application\chrome.exe');

  for I := 0 to 7 do
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
    HKCU,
    'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Google Chrome',
    BrowserPath
  ) then
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
  UILog('Initializing setup context.');
  Result := True;
  AgentInstalled := False;
  InstalledUninstallerPath := '';
  ActionSelectionPage := nil;
  UninstallProgressPage := nil;
  InstallActionRadio := nil;
  UninstallActionRadio := nil;
  MaerskEnabled := False;
  ChromeInstalled := False;
  ChromePath := '';
  DependenciesPage := nil;
  ChromeDependencyCheckBox := nil;
  ChromeDependencyStatusLabel := nil;
  InstallLogMemo := nil;
  InstallLogLabel := nil;
  UninstallProgressLogMemo := nil;
  NodeRuntimeCopyStarted := False;
  AppBundleCopyStarted := False;
  CloseWithoutIncompleteWarning := False;
  AgentInstalled := TryFindInstalledUninstaller(InstalledUninstallerPath);
  if AgentInstalled then
  begin
    UILog('Existing installation detected: ' + InstalledUninstallerPath);
  end
  else
  begin
    UILog('No existing installation detected.');
  end;

  if not TryLoadEffectiveConfig(EffectiveConfig) then
  begin
    UIErrorLog('Unable to load effective config/bootstrap template.');
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
    UILog('MAERSK provider disabled in effective config.');
    exit;
  end;

  MaerskEnabled := True;
  ChromeInstalled := FindChromeExe(ChromePath);
  if ChromeInstalled then
  begin
    UILog('Detected Chrome/Chromium dependency at: ' + ChromePath);
  end
  else
  begin
    UILog('Chrome/Chromium dependency not detected.');
  end;
end;

procedure InitializeWizard();
var
  ActionIntroLabel: TNewStaticText;
  ActionStatusLabel: TNewStaticText;
  IntroLabel: TNewStaticText;
begin
  UILog('Initializing wizard UI.');
  CreateInstallingLogPanel();
  UILog(
    'Installing page log panel ready. Showing up to ' + IntToStr(InstallLogMaxLines) + ' lines.'
  );

  ActionSelectionPage := CreateCustomPage(
    wpWelcome,
    'Escolha a acao',
    'Selecione se deseja instalar ou desinstalar o Container Tracker Agent.'
  );

  ActionIntroLabel := TNewStaticText.Create(ActionSelectionPage);
  ActionIntroLabel.Parent := ActionSelectionPage.Surface;
  ActionIntroLabel.Left := ScaleX(0);
  ActionIntroLabel.Top := ScaleY(0);
  ActionIntroLabel.Width := ActionSelectionPage.SurfaceWidth;
  ActionIntroLabel.AutoSize := False;
  ActionIntroLabel.WordWrap := True;
  ActionIntroLabel.Caption :=
    'Use instalar para aplicar ou atualizar o agente. ' +
    'Use desinstalar para remover a versao ja instalada.';
  WizardForm.AdjustLabelHeight(ActionIntroLabel);

  InstallActionRadio := TNewRadioButton.Create(ActionSelectionPage);
  InstallActionRadio.Parent := ActionSelectionPage.Surface;
  InstallActionRadio.Left := ScaleX(0);
  InstallActionRadio.Top := ActionIntroLabel.Top + ActionIntroLabel.Height + ScaleY(12);
  InstallActionRadio.Width := ActionSelectionPage.SurfaceWidth;
  InstallActionRadio.Caption := 'Instalar ou atualizar';
  InstallActionRadio.Checked := True;

  UninstallActionRadio := TNewRadioButton.Create(ActionSelectionPage);
  UninstallActionRadio.Parent := ActionSelectionPage.Surface;
  UninstallActionRadio.Left := ScaleX(0);
  UninstallActionRadio.Top := InstallActionRadio.Top + InstallActionRadio.Height + ScaleY(8);
  UninstallActionRadio.Width := ActionSelectionPage.SurfaceWidth;
  UninstallActionRadio.Caption := 'Desinstalar';
  UninstallActionRadio.Enabled := AgentInstalled;

  ActionStatusLabel := TNewStaticText.Create(ActionSelectionPage);
  ActionStatusLabel.Parent := ActionSelectionPage.Surface;
  ActionStatusLabel.Left := ScaleX(20);
  ActionStatusLabel.Top := UninstallActionRadio.Top + UninstallActionRadio.Height + ScaleY(4);
  ActionStatusLabel.Width := ActionSelectionPage.SurfaceWidth - ScaleX(20);
  ActionStatusLabel.AutoSize := False;
  ActionStatusLabel.WordWrap := True;
  if AgentInstalled then
  begin
    ActionStatusLabel.Caption :=
      'Status: instalacao existente detectada. Se escolher desinstalar, o setup sera encerrado em seguida.';
  end
  else
  begin
    ActionStatusLabel.Caption := 'Status: nenhuma instalacao existente detectada para desinstalar.';
  end;
  WizardForm.AdjustLabelHeight(ActionStatusLabel);

  CreateUninstallProgressPage();

  if not MaerskEnabled then
  begin
    exit;
  end;

  DependenciesPage := CreateCustomPage(
    ActionSelectionPage.ID,
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

function StopAgentRuntimeBeforeInstall(var ErrorMessage: string): Boolean;
var
  ResultCode: Integer;
  StopRuntimeScriptPath: string;
begin
  UILog('Preparing runtime shutdown before install/update.');
  ErrorMessage := '';
  ResultCode := -1;

  if (not RunCmdAndLogOutput(
    'Disable scheduled task {#AgentTaskName}',
    '/C schtasks /Change /TN "{#AgentTaskName}" /DISABLE || exit /B 0',
    ResultCode
  )) or (ResultCode <> 0) then
  begin
    ErrorMessage :=
      'Failed to disable scheduled task {#AgentTaskName} before install/update ' +
      '(exit code ' + IntToStr(ResultCode) + ').';
    UIErrorLog(ErrorMessage);
    Result := False;
    exit;
  end;

  if (not RunCmdAndLogOutput(
    'Disable scheduled task {#UpdaterTaskName}',
    '/C schtasks /Change /TN "{#UpdaterTaskName}" /DISABLE || exit /B 0',
    ResultCode
  )) or (ResultCode <> 0) then
  begin
    ErrorMessage :=
      'Failed to disable scheduled task {#UpdaterTaskName} before install/update ' +
      '(exit code ' + IntToStr(ResultCode) + ').';
    UIErrorLog(ErrorMessage);
    Result := False;
    exit;
  end;

  if (not RunCmdAndLogOutput(
    'Stop running task {#AgentTaskName}',
    '/C schtasks /End /TN "{#AgentTaskName}" || exit /B 0',
    ResultCode
  )) or (ResultCode <> 0) then
  begin
    ErrorMessage :=
      'Failed to stop running task {#AgentTaskName} before install/update ' +
      '(exit code ' + IntToStr(ResultCode) + ').';
    UIErrorLog(ErrorMessage);
    Result := False;
    exit;
  end;

  if (not RunCmdAndLogOutput(
    'Stop running task {#UpdaterTaskName}',
    '/C schtasks /End /TN "{#UpdaterTaskName}" || exit /B 0',
    ResultCode
  )) or (ResultCode <> 0) then
  begin
    ErrorMessage :=
      'Failed to stop running task {#UpdaterTaskName} before install/update ' +
      '(exit code ' + IntToStr(ResultCode) + ').';
    UIErrorLog(ErrorMessage);
    Result := False;
    exit;
  end;

  ExtractTemporaryFile('stop-agent-runtime.ps1');
  StopRuntimeScriptPath := ExpandConstant('{tmp}\stop-agent-runtime.ps1');
  UILog('Extracted stop runtime script to: ' + StopRuntimeScriptPath);

  if (not RunCmdAndLogOutput(
    'Terminate agent runtime processes',
    '/C powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' +
    StopRuntimeScriptPath + '"',
    ResultCode
  )) or (ResultCode <> 0) then
  begin
    ErrorMessage :=
      'Failed to terminate running agent processes before install/update ' +
      '(exit code ' + IntToStr(ResultCode) + ').';
    UIErrorLog(ErrorMessage);
    Result := False;
    exit;
  end;

  UILog('Runtime shutdown checks completed.');
  Result := True;
end;

procedure RunChosenUninstallAndCloseSetup();
var
  LaunchResultCode: Integer;
  StopRuntimeError: string;
  CleanupLogPath: string;
  UninstallerLogPath: string;
  UninstallerCommandLine: string;
begin
  UILog('Uninstall flow selected from installer action page.');
  if not AgentInstalled then
  begin
    UIErrorLog('Uninstall requested but agent is not installed.');
    MsgBox('Container Tracker Agent nao esta instalado neste computador.', mbInformation, MB_OK);
    exit;
  end;

  if InstalledUninstallerPath = '' then
  begin
    UIErrorLog('Installed uninstaller path was not found.');
    MsgBox('Nao foi possivel localizar o desinstalador instalado.', mbCriticalError, MB_OK);
    exit;
  end;

  if MsgBox(
    'Isso vai desinstalar o Container Tracker Agent deste computador. Deseja continuar?',
    mbConfirmation,
    MB_YESNO
  ) <> IDYES then
  begin
    UILog('User canceled uninstall confirmation dialog.');
    exit;
  end;

  CleanupLogPath := ExpandConstant(UninstallCleanupLogPathConstant);
  UninstallerLogPath := ExpandConstant(UninstallerRunLogPathConstant);
  DeleteFile(UninstallerLogPath);
  StopRuntimeError := '';

  UILog('Running pre-uninstall runtime stop to reduce locked files/processes.');
  if not StopAgentRuntimeBeforeInstall(StopRuntimeError) then
  begin
    UIErrorLog('Pre-uninstall runtime stop failed: ' + StopRuntimeError);
    if MsgBox(
      'Falhou ao encerrar completamente processos em execucao antes da desinstalacao.' + #13#10 +
      StopRuntimeError + #13#10 + #13#10 +
      'Deseja tentar desinstalar mesmo assim?',
      mbConfirmation,
      MB_YESNO
    ) <> IDYES then
    begin
      UILog('User aborted uninstall after pre-uninstall runtime stop failure.');
      exit;
    end;
  end;

  UninstallerCommandLine :=
    '/NORESTART /LOG="' + UninstallerLogPath + '"';
  UILog('Scheduling installed uninstaller: ' + InstalledUninstallerPath);
  UILog('Uninstaller parameters: ' + UninstallerCommandLine);
  if not LaunchDeferredInstalledUninstaller(
    InstalledUninstallerPath,
    UninstallerCommandLine,
    LaunchResultCode
  ) then
  begin
    UIErrorLog('Failed to schedule installed uninstaller launch.');
    MsgBox(
      'Falha ao agendar a execucao do desinstalador.' + #13#10 + #13#10 +
      'Uninstaller: ' + InstalledUninstallerPath + #13#10 +
      'Cleanup log: ' + CleanupLogPath + #13#10 +
      'Uninstaller log: ' + UninstallerLogPath,
      mbCriticalError,
      MB_OK
    );
    exit;
  end;

  UILog('Deferred uninstaller launcher started (pid=' + IntToStr(LaunchResultCode) + ').');
  UILog('Closing setup now so uninstall can continue without setup mutex contention.');
  CloseSetupWithoutIncompleteWarning();
end;

function ShouldInstallChromeDependency(): Boolean;
begin
  Result :=
    MaerskEnabled and
    (not ChromeInstalled) and
    (ChromeDependencyCheckBox <> nil) and
    ChromeDependencyCheckBox.Checked;
end;

function IsUninstallActionSelected(): Boolean;
begin
  Result := (UninstallActionRadio <> nil) and UninstallActionRadio.Checked;
end;

procedure CloseSetupWithoutIncompleteWarning();
begin
  CloseWithoutIncompleteWarning := True;
  WizardForm.Close;
end;

function InstallChromeDependency(var ErrorMessage: string): Boolean;
var
  ResultCode: Integer;
  CommandParams: string;
begin
  UILog('Chrome/Chromium dependency installation requested.');
  ResultCode := -1;
  CommandParams :=
    '/C winget install --id Google.Chrome --exact --source winget ' +
    '--accept-package-agreements --accept-source-agreements --silent --disable-interactivity';

  if (not RunCmdAndLogOutput('Install Chrome via winget', CommandParams, ResultCode)) or
     (ResultCode <> 0) then
  begin
    ErrorMessage :=
      'Automatic Chrome install failed (winget exit code ' + IntToStr(ResultCode) + '). ' +
      'Install Google Chrome or Chromium manually and run setup again.';
    UIErrorLog(ErrorMessage);
    Result := False;
    exit;
  end;

  if not FindChromeExe(ChromePath) then
  begin
    ErrorMessage :=
      'Chrome install command completed, but chrome.exe was not found. ' +
      'Install Google Chrome or Chromium manually and run setup again.';
    UIErrorLog(ErrorMessage);
    Result := False;
    exit;
  end;

  UILog('Chrome/Chromium dependency detected after install: ' + ChromePath);
  ChromeInstalled := True;
  Result := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if (UninstallProgressPage <> nil) and (CurPageID = UninstallProgressPage.ID) then
  begin
    RunChosenUninstallAndCloseSetup();
    Result := False;
    exit;
  end;

  if IsUninstallActionSelected() then
  begin
    exit;
  end;

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

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;

  if (UninstallProgressPage <> nil) and (PageID = UninstallProgressPage.ID) then
  begin
    Result := not IsUninstallActionSelected();
    exit;
  end;

  if (DependenciesPage <> nil) and (PageID = DependenciesPage.ID) then
  begin
    Result := IsUninstallActionSelected();
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ErrorMessage: string;
begin
  UILog('PrepareToInstall started.');
  UILog('Resolved install target directory: ' + ExpandConstant('{app}'));
  Result := '';

  if not StopAgentRuntimeBeforeInstall(ErrorMessage) then
  begin
    UIErrorLog('PrepareToInstall failed while stopping existing runtime.');
    Result := ErrorMessage;
    exit;
  end;

  if not MaerskEnabled then
  begin
    UILog('MAERSK dependency flow skipped (MAERSK_ENABLED is off).');
    exit;
  end;

  if ChromeInstalled then
  begin
    UILog('Chrome/Chromium dependency already satisfied.');
    exit;
  end;

  if not ShouldInstallChromeDependency() then
  begin
    Result :=
      'Chrome/Chromium nao foi encontrado. Marque a instalacao automatica na pagina de dependencias ' +
      'ou instale manualmente antes de executar este setup.';
    UIErrorLog(Result);
    exit;
  end;

  if InstallChromeDependency(ErrorMessage) then
  begin
    UILog('PrepareToInstall finished successfully.');
    exit;
  end;

  UIErrorLog('PrepareToInstall failed while installing Chrome dependency.');
  Result := ErrorMessage;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (UninstallProgressPage <> nil) and (CurPageID = UninstallProgressPage.ID) then
  begin
    UILog('Uninstall log page opened. Click Next to start uninstall.');
    WizardForm.NextButton.Caption := SetupMessage(msgButtonNext);
    exit;
  end;

  if CurPageID = wpInstalling then
  begin
    UILog('Installing page opened. Real-time operational log is visible by default.');
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    UILog('Install step started: creating directories and copying release artifacts.');
    exit;
  end;

  if CurStep = ssPostInstall then
  begin
    UILog('Post-install step started: configuring scheduled tasks and runtime startup.');
    exit;
  end;

  if CurStep = ssDone then
  begin
    UILog('Installer finished successfully.');
  end;
end;

procedure CreateUninstallProgressPage();
var
  IntroLabel: TNewStaticText;
begin
  UninstallProgressPage := CreateCustomPage(
    ActionSelectionPage.ID,
    'Desinstalacao com logs',
    'Acompanhe o log operacional da desinstalacao.'
  );

  IntroLabel := TNewStaticText.Create(UninstallProgressPage);
  IntroLabel.Parent := UninstallProgressPage.Surface;
  IntroLabel.Left := ScaleX(0);
  IntroLabel.Top := ScaleY(0);
  IntroLabel.Width := UninstallProgressPage.SurfaceWidth;
  IntroLabel.AutoSize := False;
  IntroLabel.WordWrap := True;
  IntroLabel.Caption :=
    'Clique em Next para iniciar a desinstalacao. ' +
    'As etapas e eventuais erros aparecerao no painel abaixo.';
  WizardForm.AdjustLabelHeight(IntroLabel);

  UninstallProgressLogMemo := TMemo.Create(UninstallProgressPage);
  UninstallProgressLogMemo.Parent := UninstallProgressPage.Surface;
  UninstallProgressLogMemo.Left := ScaleX(0);
  UninstallProgressLogMemo.Top := IntroLabel.Top + IntroLabel.Height + ScaleY(10);
  UninstallProgressLogMemo.Width := UninstallProgressPage.SurfaceWidth;
  UninstallProgressLogMemo.Height :=
    UninstallProgressPage.SurfaceHeight - UninstallProgressLogMemo.Top - ScaleY(8);
  if UninstallProgressLogMemo.Height < ScaleY(InstallLogMinHeight) then
  begin
    UninstallProgressLogMemo.Height := ScaleY(InstallLogMinHeight);
  end;
  UninstallProgressLogMemo.ReadOnly := True;
  UninstallProgressLogMemo.ScrollBars := ssVertical;
  UninstallProgressLogMemo.WordWrap := False;
  UninstallProgressLogMemo.TabStop := False;
end;

function InitializeUninstall(): Boolean;
begin
  Log('InitializeUninstall: starting uninstall flow for {#AppName}.');
  Log('InitializeUninstall: install root=' + ExpandConstant('{app}'));
  Log('InitializeUninstall: runtime cleanup log=' +
    ExpandConstant('{localappdata}\ContainerTracker\logs\uninstall-cleanup.log'));
  Result := True;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  Log('CurUninstallStepChanged: step=' + IntToStr(Ord(CurUninstallStep)));
end;

procedure CancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  if CloseWithoutIncompleteWarning then
  begin
    Confirm := False;
  end;
end;
