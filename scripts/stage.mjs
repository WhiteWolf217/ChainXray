import {
  cpSync,
  copyFileSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { resolve, join, basename } from "node:path";
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("vite/package.json"))("esbuild");
const out = resolve("src-tauri/resources");
mkdirSync(join(out, "engine"), { recursive: true });
rmSync(join(out, 'test-dapp.html'), {force:true});
for (const name of ["server", "mcp"]) {
  await esbuild.build({
    entryPoints: ["engine/" + name + ".ts"],
    outfile: join(out, "engine", name + ".mjs"),
    format: "esm",
    target: "node24",
    platform: "node",
    bundle: true,
    banner: {
      js: "import {createRequire as __require} from 'node:module';const require=__require(import.meta.url);",
    },
  });
}
for (const name of [
  "dist",
  "fixtures",
  "apps/browser-extension",
  "runtime",
  "THIRD_PARTY_NOTICES.md",
  "LICENSE",
  "notices",
  "README.md",
])
  cpSync(name, join(out, name), { recursive: true });
copyFileSync(process.execPath, join(out, "node.exe"));
// Preserve notices from packages included in either JavaScript bundle.
for (const entry of readdirSync("node_modules/.pnpm", {
  withFileTypes: true,
})) {
  if (!entry.isDirectory() || !entry.name.includes("@")) continue;
  const folder = join("node_modules/.pnpm", entry.name, "node_modules");
  if (!existsSync(folder)) continue;
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    if (!item.isDirectory() || item.isSymbolicLink()) continue;
    const base = join(folder, item.name);
    const dirs = item.name.startsWith("@")
      ? readdirSync(base).map((n) => join(base, n))
      : [base];
    for (const dir of dirs) {
      for (const file of readdirSync(dir).filter((f) =>
        /^licen[cs]e(\.(txt|md)|$)/i.test(f),
      )) {
        copyFileSync(
          join(dir, file),
          join(out, "notices", entry.name.split("(")[0] + "-" + basename(file)),
        );
      }
    }
  }
}
for (const tool of ["anvil", "forge"]) {
  const rel = "node_modules/@foundry-rs/" + tool + "-win32-amd64/bin";
  mkdirSync(join(out, rel), { recursive: true });
  copyFileSync(join(rel, tool + ".exe"), join(out, rel, tool + ".exe"));
}
writeFileSync(
  join(out, "Start ChainXray.cmd"),
  '@echo off\r\ncd /d "%~dp0"\r\nif not exist "%SystemRoot%\\System32\\vcruntime140.dll" start "" /wait runtime\\VC_redist.x64.exe /install /passive /norestart\r\nset "CHAINXRAY_HOME=%LOCALAPPDATA%\\ChainXray\\workspaces"\r\nnode.exe engine/server.mjs --browser\r\n',
);

