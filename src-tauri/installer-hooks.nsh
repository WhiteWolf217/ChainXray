!macro NSIS_HOOK_POSTINSTALL
  ; Run the bundled redistributable even if an older runtime is already present.
  ; The setup runs elevated (perMachine). 1638 means a newer version exists.
  ClearErrors
  StrCpy $0 -1
  ExecWait '"$INSTDIR\resources\runtime\VC_redist.x64.exe" /install /quiet /norestart' $0
  IfErrors chainxray_runtime_failed
  StrCmp $0 0 chainxray_runtime_ready
  StrCmp $0 3010 chainxray_runtime_reboot
  StrCmp $0 1638 chainxray_runtime_ready
  chainxray_runtime_failed:
  MessageBox MB_OK|MB_ICONSTOP "Visual C++ runtime setup failed (code $0). Run resources\runtime\VC_redist.x64.exe from the install folder before starting ChainXray."
  Abort
  chainxray_runtime_reboot:
  SetRebootFlag true
  chainxray_runtime_ready:
!macroend
