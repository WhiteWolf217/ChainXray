$ErrorActionPreference='Stop'
$root=Resolve-Path "$PSScriptRoot/.."
$release=New-Item -Type Directory -Force "$root/release"
$archive=Join-Path $release 'ChainXray-windows-x64.zip'
tar.exe -acf $archive -C "$root/src-tauri/resources" .
if ($LASTEXITCODE) {throw 'ZIP failed'}
(Get-FileHash $archive).Hash.ToLower()+'  ChainXray-windows-x64.zip' | Set-Content "$release/SHA256SUMS.txt"
