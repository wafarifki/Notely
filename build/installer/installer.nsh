# ─────────────────────────────────────────────────────────────────────────────
# Notely - NSIS installer hooks
#
# `electron-builder.yml` points here with `nsis.include`. Everything in this file
# is spliced into the generated NSIS script:
#
#   customInstall   - runs after the app files are copied
#   customUnInstall - runs before the uninstaller removes them
#
# Both call `context-menu.ps1`, which owns the actual registry keys (Explorer
# right-click entries: Create New Task / Notes / TXT). Keeping the registry
# work in PowerShell means one readable, re-runnable implementation shared by
# the per-user and per-machine installs.
#
# Scope: `$INSTDIR` under Program Files means the installer was elevated for
# "all users", so the menu entries must live in HKLM to be visible to every
# account. Otherwise they go into HKCU for the current user only.
# ─────────────────────────────────────────────────────────────────────────────

!macro customInstall
  DetailPrint "Adding Notely to the Explorer context menu..."
  ; The helper is shipped through electron-builder's `extraResources`, so it is
  ; a real file at $INSTDIR\resources\installer\context-menu.ps1 (NOT inside
  ; app.asar — PowerShell cannot read it from there).
  ${If} ${FileExists} "$INSTDIR\resources\installer\context-menu.ps1"
    DetailPrint "Context menu helper found."
  ${Else}
    DetailPrint "Warning: context menu helper missing; skipping."
    Goto customInstallDone
  ${EndIf}
  ; `$installMode` is "all" for a per-machine install and "currentUser"
  ; otherwise; that decides whether the entries go to HKLM or HKCU.
  ${if} $installMode == "all"
    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\installer\context-menu.ps1" -ExePath "$INSTDIR\${APP_EXECUTABLE_FILENAME}" -Mode Install -PerMachine'
  ${else}
    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\installer\context-menu.ps1" -ExePath "$INSTDIR\${APP_EXECUTABLE_FILENAME}" -Mode Install'
  ${endIf}
  Pop $0
  DetailPrint "Context menu helper exit code: $0"
  customInstallDone:
!macroend

!macro customUnInstall
  DetailPrint "Removing Notely from the Explorer context menu..."
  ${If} ${FileExists} "$INSTDIR\resources\installer\context-menu.ps1"
    ; Clean both hives: an upgrade from per-user to per-machine (or back) can
    ; leave an entry behind under the other scope.
    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\installer\context-menu.ps1" -ExePath "$INSTDIR\${APP_EXECUTABLE_FILENAME}" -Mode Uninstall'
    Pop $0
    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\installer\context-menu.ps1" -ExePath "$INSTDIR\${APP_EXECUTABLE_FILENAME}" -Mode Uninstall -PerMachine'
    Pop $0
  ${EndIf}
!macroend
