import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
const executablePath = [
  process.env.ProgramFiles,
  process.env["ProgramFiles(x86)"],
].filter(Boolean)
  .flatMap((dir) => [
    join(dir, "Microsoft/Edge/Application/msedge.exe"),
    join(dir, "Google/Chrome/Application/chrome.exe"),
  ])
  .find(existsSync);
if (!executablePath)
  throw Error("Chrome or Edge was not found in the Windows Program Files paths");
const proc = spawn(process.execPath, ["engine/server.ts", "--parent-pipe"], {
  stdio: ["pipe", "pipe", "inherit"],
  windowsHide: true,
  env: {
    ...process.env,
    CHAINXRAY_HOME: mkdtempSync(join(tmpdir(), "cx-ui-")),
  },
});
let browser;
try {
  const url = await new Promise((r, j) => {
    createInterface({ input: proc.stdout }).once("line", r);
    proc.once("exit", () => j(Error("Engine closed")));
  });
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-background-networking", "--disable-component-update"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  await page.goto(url);
  const click = (text) =>
    page.getByRole("button", { name: text, exact: true }).click();
  await click("Create or reopen");
  await click("Start chain");
  await click("Deploy vault");
  await click("Capture takeover");
  await click("Send to Repeater");
  await click("Run Repeater");
  await page
    .locator("pre")
    .filter({ hasText: "Unauthorized owner change" })
    .waitFor();
  await click("Findings");
  await click("Run vault reproduction");
  await page.locator("pre").filter({ hasText: "1 passed" }).waitFor();
  await click("Frames");
  await click("Run Frames");
  await page.locator("pre").filter({ hasText: '"admitted": true' }).waitFor();
  await click("Run Frames");
  await page.locator("pre").filter({ hasText: "Nonce mismatch" }).waitFor();
  await click("Reports");
  const download = page.waitForEvent("download");
  await click("Save JSON archive");
  assert.match((await download).suggestedFilename(), /\.json$/);
  console.log(
    "Browser workflow passed: workspace, chain, vault, repeater, findings, Forge, frame replay, report.",
  );
} finally {
  await browser?.close();
  proc.stdin.end();
}
