$ErrorActionPreference='Stop'
$projectRoot=Resolve-Path "$PSScriptRoot/.."
Set-Location $projectRoot
& powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot/build-windows.ps1"
if($LASTEXITCODE -ne 0){throw 'Windows installer build failed'}
$bundle=Get-ChildItem -LiteralPath 'src-tauri/target/release/bundle/nsis' -Filter '*-setup.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if(!$bundle){throw 'NSIS setup executable was not produced'}
& node scripts/verify-installer.mjs $bundle.FullName
if($LASTEXITCODE -ne 0){throw 'Installer payload verification failed'}
$releaseDir=Join-Path $projectRoot 'release'
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$setupPath=Join-Path $releaseDir 'ChainXray-Setup-x64.exe'
Copy-Item -LiteralPath $bundle.FullName -Destination $setupPath -Force
$checksum=Get-FileHash -LiteralPath $setupPath -Algorithm SHA256
[System.IO.File]::WriteAllText((Join-Path $releaseDir 'ChainXray-Setup-x64.sha256'),($checksum.Hash.ToLower()+'  ChainXray-Setup-x64.exe'+[Environment]::NewLine))
Write-Output "Windows x64 installer: $setupPath"
Write-Output "SHA256: $($checksum.Hash)"
