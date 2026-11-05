!macro NSIS_HOOK_POSTINSTALL
  IfFileExists "$SYSDIR\vcruntime140.dll" chainxray_runtime_ready
  ExecWait '"$INSTDIR\resources\runtime\VC_redist.x64.exe" /install /passive /norestart'
  chainxray_runtime_ready:
!macroend
