import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
import { controller } from "./actions.ts";
import { stop } from "./lab.ts";
import { actionEnvelope } from "./validation.ts";
import { InterceptQueue } from './intercept.ts';
import { openBrowser } from './browser.ts';
import { dappTarget } from './dapp-target.ts';
import {configureUniswapApi,uniswapApiConfigured} from './uniswap-api.ts';
import {configureArkiv,arkivStatus,checkArkivConnection} from './public-findings.ts';
const intercept = new InterceptQueue();
const act = controller(resolve(process.env.CHAINXRAY_HOME ?? ".chainxray"));
const key = randomBytes(32).toString("hex");
let captureKey = "",
  captureExpires = 0,
  captureRemaining = 0;
let expectedChainId:string|null=null;
const dist = fileURLToPath(new URL("../dist", import.meta.url));
const server = createServer(async (req, res) => {
  const reply = (status: number, body: string, type = "application/json") => {
    res.writeHead(status, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
    });
    res.end(body);
  };
  try {
    if (req.headers.host !== "127.0.0.1:" + server.address()!.port)
      throw Error("Invalid host");
    if (req.method === "POST" && req.url === "/api") {
      const paired =
        captureKey.length > 0 &&
        Date.now() < captureExpires &&
        req.headers.authorization === "Bearer " + captureKey;
      if (!paired && req.headers.authorization !== "Bearer " + key)
        return reply(403, "{}");
      let size = 0;
      const parts = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8e6) throw Error("Import exceeds 8 MB");
        parts.push(chunk);
      }
      const { action, payload } = actionEnvelope(
        JSON.parse(Buffer.concat(parts).toString()),
      );
      if (paired) {
        if (
          !["capture", "intercept", "intercept_poll", "wallet_outcome"].includes(action) ||
          req.headers.authorization !== "Bearer " + captureKey
        )
          return reply(403, "{}");
        if (action === "intercept_poll") return reply(200, JSON.stringify(payload.id==='connection-check'?{status:'ready',expectedChainId}:intercept.poll(String(payload.id))));
        if (captureRemaining <= 0) return reply(429, JSON.stringify({error:"Pairing request limit reached. Pair again."}));
        captureRemaining--;
        if(action==='wallet_outcome') return reply(200,JSON.stringify(await act(action,payload)));
        if (action === "intercept") {
          const queued=intercept.add(payload.request,String(payload.origin));
          const chainId=typeof payload.chainId==='string'&&/^0x[0-9a-f]{1,16}$/i.test(payload.chainId)?payload.chainId:null;
          if(expectedChainId&&chainId!==expectedChainId){intercept.rows.delete(queued.id);throw Error('Select Ethereum Sepolia in the wallet, then enable interception again.');}
          intercept.rows.get(queued.id).chainId=chainId;
          try { const capture=await act('capture',{...(payload.request as any),captureChainId:chainId,origin:String(payload.origin),interception:{id:queued.id,status:'held',hook:payload.hook==='metamask-sdk'?'metamask-sdk':payload.hook==='injected-provider'?'injected-provider':'metamask-message-channel'}}); intercept.rows.get(queued.id).sourceEvidence=capture.id; }
          catch(error){intercept.rows.delete(queued.id);throw error;}
          return reply(200,JSON.stringify(queued));
        }
        const row = await act("capture", payload);
        return reply(200, JSON.stringify({ id: row.id }));
      }
      if (action === "intercept_list") return reply(200, JSON.stringify(intercept.list()));
      if(action === 'uniswap_configure') return reply(200,JSON.stringify(configureUniswapApi(payload.key)));
      if(action === 'uniswap_status') return reply(200,JSON.stringify({configured:uniswapApiConfigured()}));
      if(action === 'arkiv_configure') return reply(200,JSON.stringify(configureArkiv(payload)));
      if(action === 'arkiv_status') return reply(200,JSON.stringify(arkivStatus()));
      if(action === 'arkiv_check') return reply(200,JSON.stringify(await checkArkivConnection()));
      if (action === "intercept_decide") {
        const id=String(payload.id), row=intercept.rows.get(id);
        const before=row ? structuredClone(row) : null;
        intercept.decide(id, String(payload.decision), payload.request);
        try { await act('capture',{...row.request,captureChainId:row.chainId??null,origin:row.origin,interception:{id,status:String(payload.decision),originalRequest:before.request}}); }
        catch(error){if(before)intercept.rows.set(id,before);throw error;}
        return reply(200, "true");
      }
      if (action === "open" || action === "close") { captureKey = ""; intercept.clear(); }
      if (action === "pair" || action === "browser_open") {
        const destination=dappTarget(payload.url??'https://app.uniswap.org/');
        if(payload.network!==undefined&&payload.network!=='sepolia')throw Error('Unsupported browser test network');
        if (!(await act("state")).workspace)
          throw Error("Open a workspace first");
        intercept.clear();
        expectedChainId=payload.network==='sepolia'||action==='browser_open'?'0xaa36a7':null;
        captureKey = randomBytes(32).toString("hex");
        captureRemaining = 500;
        captureExpires = Date.now() + 15 * 60_000;
        if (action === 'browser_open') return reply(200, JSON.stringify(await openBrowser('http://' + req.headers.host + '/#' + captureKey, destination)));
        return reply(
          200,
          JSON.stringify("http://" + req.headers.host + "/#" + captureKey),
        );
      }
      return reply(200, JSON.stringify(await act(action, payload)));
    }
    if (req.method !== "GET") return reply(405, "{}");
    const path = resolve(
      dist,
      "." + (req.url === "/" ? "/index.html" : decodeURIComponent(req.url!)),
    );
    if (!path.startsWith(dist + sep)) throw Error("Invalid path");
    const mime = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
    }[extname(path)];
    if (!mime) return reply(404, "{}");
    reply(200, await readFile(path, "utf8"), mime);
  } catch (e) {
    reply(
      400,
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
    );
  }
});
server.listen(0, "127.0.0.1", () => {
  const url = "http://127.0.0.1:" + server.address()!.port + "/#" + key;
  console.log(url);
  if (process.argv.includes("--browser"))
    spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
      windowsHide: true,
      stdio: "ignore",
    }).unref();
});
process.on("exit", stop);
process.on("SIGTERM", () => process.exit());
process.on("SIGINT", () => process.exit());
if (process.argv.includes("--parent-pipe"))
  process.stdin.resume().on("end", () => process.exit());
