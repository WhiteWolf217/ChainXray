$ErrorActionPreference='Stop'
$root=Resolve-Path "$PSScriptRoot/.."
Set-Location $root
if(Test-Path .build-tools/cargo/bin/rustup.exe){
 $env:RUSTUP_HOME="$root/.build-tools/rustup"
 $env:CARGO_HOME="$root/.build-tools/cargo"
 $env:Path="$env:CARGO_HOME/bin;$env:Path"
}
$llvm=Get-ChildItem .build-tools -Directory -Filter 'llvm-mingw-*' -ErrorAction SilentlyContinue | Select-Object -First 1
if(Test-Path .build-tools/mingw64/bin/gcc.exe){
 $env:Path="$root/.build-tools/mingw64/bin;$env:Path"
 $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER="$root/.build-tools/mingw64/bin/gcc.exe"
 $env:CC_x86_64_pc_windows_gnu='gcc'
 $env:CXX_x86_64_pc_windows_gnu='g++'
 $env:RC='windres'
}elseif($llvm){
 $env:Path="$($llvm.FullName)/bin;$env:Path"
 $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER="$env:RUSTUP_HOME/toolchains/stable-x86_64-pc-windows-gnu/lib/rustlib/x86_64-pc-windows-gnu/bin/self-contained/x86_64-w64-mingw32-gcc.exe"
 $env:CC_x86_64_pc_windows_gnu='x86_64-w64-mingw32-clang'
 $env:CXX_x86_64_pc_windows_gnu='x86_64-w64-mingw32-clang++'
 $env:RC='x86_64-w64-mingw32-windres'
}
node_modules/.bin/tauri.cmd build
exit $LASTEXITCODE

