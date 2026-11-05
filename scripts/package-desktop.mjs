import { existsSync, mkdirSync, copyFileSync, cpSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
await import('./build.mjs');
const binary = resolve('src-tauri/target/release/chainxray.exe');
if (!existsSync(binary)) throw Error('Build the native Windows executable first with scripts/build-windows.ps1');
const out = resolve(process.env.CHAINXRAY_PACKAGE_DIR || 'release/ChainXray Desktop');
mkdirSync(out, { recursive: true });
if (!existsSync(join(out, 'ChainXray.exe'))) copyFileSync(binary, join(out, 'ChainXray.exe'));
else { const {readFileSync}=await import('node:fs'); if(!readFileSync(binary).equals(readFileSync(join(out,'ChainXray.exe')))) copyFileSync(binary,join(out,'ChainXray.exe')); }
cpSync('src-tauri/resources', join(out, 'resources'), { recursive: true });
writeFileSync(join(out, 'READ ME.txt'), `Launch ChainXray.exe to open the standalone desktop workbench.
Keep the resources folder beside the executable. No Chrome tab is needed for the workbench.
Windows WebView2 Runtime is required. The engine runs privately on this computer.
The bundled resources/runtime folder contains additional runtime installers if needed.

Open a workspace and click Open Browser to launch the bundled Chromium with MetaMask.
Complete MetaMask setup yourself. Open the ChainXray extension on your dapp tab and enable
MetaMask interception before connecting the dapp. The pairing link is filled automatically.
Reload the dapp to disable interception. Pairing expires after 15 minutes.
`);
console.log('Desktop package: ' + out);
