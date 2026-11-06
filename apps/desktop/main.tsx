import { Evidence, markdown } from "./Evidence";
import { UniswapPanel } from './UniswapPanel';
import { ArkivSettings } from './ArkivSettings';
import { LiveDapps } from './LiveDapps';
import { RequestFlow } from './RequestFlow';
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
const token = location.hash.slice(1) || sessionStorage.getItem("lab-token");
sessionStorage.setItem("lab-token", token || "");
history.replaceState(null, "", "/");
async function api(action: string, payload: any = {}) {
  const r = await fetch("/api", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, payload }),
  });
  const v = await r.json();
  if (!r.ok) throw Error(v.error || "Open the URL printed by ChainXray");
  return v;
}
function save(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body]));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const pages = ['Live Dapps', 'Intercept', 'Web3 History', 'Request Flow', 'Decoder', 'Repeater', 'Uniswap API', 'Findings', 'Reports', 'Shared Findings'];
const advancedPages = ['Home', 'Workspace setup', 'Sessions', 'Intruder', 'Scanner', 'Contracts', 'Simulator', 'Frames'];
const pageLabels: Record<string, string> = { 'Live Dapps': 'Get started', 'Web3 History': 'Request history', Home: 'Local lab', Frames: 'Frame admission lab', 'Shared Findings': 'Share findings' };
const pretty = (x: any) => JSON.stringify(x, null, 2);
function SharedFindings({rows}:any){
 const [id,setId]=useState(''),[preview,setPreview]=useState<any>(null),[owner,setOwner]=useState(''),[result,setResult]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const execute=async(fn:any)=>{setBusy(true);setError('');try{await fn();}catch(e){setError(String(e));}finally{setBusy(false);}};
 return <section><h2>Share a sanitized observation</h2><p>Only the exact fields in the preview leave this device. Raw captures remain local. Published data is public; seven-day expiration does not erase copies.</p><select value={id} onChange={e=>{setId(e.target.value);setPreview(null);}}><option value="">Select swap or lifecycle evidence</option>{rows.filter((r:any)=>r.output?.uniswap || ["wallet_outcome","receipt_read","trace_read"].includes(r.kind)).map((r:any)=><option key={r.id} value={r.id}>{r.id.slice(0,12)} · {r.output.functionName || r.kind}</option>)}</select><button disabled={busy||!id} onClick={()=>execute(async()=>setPreview(await api('public_preview',{id})))}>Preview public fields</button>{preview&&<><pre>{pretty(preview)}</pre><button disabled={busy} onClick={()=>execute(async()=>setResult(await api('arkiv_publish',{id,confirmation:JSON.stringify(preview)})))}>Publish preview to Rabdi testnet</button><button onClick={()=>save('public-observation.json',pretty(preview))}>Export sanitized JSON offline</button></>}<h2>Find published observations</h2><input aria-label="Publisher wallet" placeholder="Publisher wallet address" value={owner} onChange={e=>setOwner(e.target.value)}/><button disabled={busy} onClick={()=>execute(async()=>setResult(await api('arkiv_query',{owner})))}>Query Arkiv</button><p>{error}</p>{result&&<pre>{pretty(result)}</pre>}</section>;
}
function InterceptPanel({onRepeater}:any) {
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[selected,setSelected]=useState('');
 useEffect(()=>{const refresh=()=>api('intercept_list').then(setRows).catch(e=>setError(String(e)));refresh();const t=setInterval(refresh,1000);return()=>clearInterval(t);},[]);
 const row=rows.find(r=>r.id===selected)??rows[0];
 return <section><p>{rows.length} held request(s). Forward releases the request to the wallet; Send to Repeater copies it for local testing and leaves it held.</p><p>{error}</p>{rows.length>1 && <select aria-label="Held request" value={row.id} onChange={e=>setSelected(e.target.value)}>{rows.map(r=><option key={r.id} value={r.id}>{r.request.method} — {r.origin}</option>)}</select>}{row?<HeldRequest key={row.id} row={row} onError={setError} onRepeater={onRepeater}/>:<><div><button disabled>Forward</button><button disabled>Drop</button><button disabled>Send to Repeater</button></div><textarea aria-label="Intercepted request" rows={14} readOnly placeholder="Waiting for a wallet request…"/><p>Open Browser, enable wallet interception in the ChainXray extension on your dapp tab, then initiate a transaction or signing request. Simply browsing a page does not create a wallet request.</p></>}</section>;
}
function HeldRequest({row,onError,onRepeater}:any) {
 const [draft,setDraft]=useState(JSON.stringify(row.request,null,2)),[busy,setBusy]=useState(false);
 const decide=async(decision:string)=>{setBusy(true);try{await api('intercept_decide',{id:row.id,decision,request:decision==='forward'?JSON.parse(draft):undefined});}catch(e){onError(String(e));}finally{setBusy(false);}};
 const send=()=>{try{const request=JSON.parse(draft);if(!['eth_sendTransaction','eth_call','eth_estimateGas'].includes(request.method)||!request.params?.[0]||typeof request.params[0]!=='object')throw Error('Repeater currently accepts unsigned transaction requests. Signed payloads and messages cannot be replayed here.');onRepeater(request.params[0]);}catch(e){onError(String(e));}};
 return <article><div><button disabled={busy} onClick={()=>decide('forward')}>Forward</button><button disabled={busy} onClick={()=>decide('drop')}>Drop</button><button disabled={busy} onClick={send}>Send to Repeater</button></div><p>{row.origin} · {row.request.method}</p><textarea aria-label="Intercepted request" rows={16} value={draft} onChange={e=>setDraft(e.target.value)}/><p>Forwarding can lead to a transaction on the wallet’s selected network. Held requests expire after five minutes.</p></article>;
}
function App() {
  const [page, setPage] = useState("Live Dapps"),
    [state, setState] = useState<any>({ rows: [], lab: {}, workspaces: [] }),
    [name, setName] = useState("vault-lab"),
    [draft, setDraft] = useState("{}"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<any>(null);
  const refresh = async () => setState(await api("state"));
  useEffect(() => {
    refresh().catch((e) => setNotice(e.message));
  }, []);
  useEffect(() => {
    if(!['Web3 History', 'Request Flow'].includes(page) || !state.workspace) return;
    const timer=setInterval(()=>refresh().catch(e=>setNotice(String(e))),1000);
    refresh().catch(e=>setNotice(String(e)));
    return ()=>clearInterval(timer);
  },[page,state.workspace]);
  async function run(action: string, p: any = {}) {
    setBusy(true);
    setNotice("");
    try {
      const r = await api(action, p);
      if (r?.id) setSelected(r);
      else setSelected(null);
      await refresh();
      setNotice("Completed · " + action);
      return r;
    } catch (e) {
      setNotice(String(e));
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, fn: () => any) => (
    <button
      disabled={busy}
      onClick={() =>
        Promise.resolve()
          .then(fn)
          .catch((e) => setNotice(String(e)))
      }
    >
      {label}
    </button>
  );
  const action = (label: string, key: string) =>
    button(label, () => run(key, JSON.parse(draft)));
  const { rows, lab, workspace } = state;
  const findings = rows.filter((r: any) => r.output?.finding);
  function navigate(p: string) {
    setPage(p);
    setSelected(null);
    if (p === "Frames") setDraft(pretty(state.frame));
    if (p === "Intruder" && !draft.includes('"cases"')) {
      try {
        setDraft(
          pretty({
            cases: [JSON.parse(draft), { ...JSON.parse(draft), value: "0x1" }],
          }),
        );
      } catch {
        setDraft('{"cases":[]}');
      }
    }
  }
  const list = (items: any[]) => (
    <div>
      {items.length ? (
        items.map((r) => (
          <button className="record" key={r.id} onClick={() => setSelected(r)}>
            <code>{r.id.slice(0, 10)}</code>
            <b>{r.output?.finding || r.input?.method || r.kind}{r.kind==='capture' && r.input?.params?.[0]?.from && <span style={{display:'block',fontSize:11}}>From: {r.input.params[0].from}</span>}</b>
            <small>{r.input?.interception?.status ? r.input.interception.status + ' · ' : ''}{r.time}</small>
          </button>
        ))
      ) : (
        <p>No evidence in this view yet.</p>
      )}
    </div>
  );
  let edited: any = {};
  try {
    edited = JSON.parse(draft);
  } catch {}
  const fields = (
    <div className="fields">
      {["from", "to", "value", "data"].map((field) => (
        <label key={field}>
          {field}
          <input
            value={edited?.[field] ?? ""}
            onChange={(e) => setDraft(pretty({ ...edited, [field]: e.target.value }))}
          />
        </label>
      ))}
    </div>
  );
  const editor = (
    <textarea
      aria-label="JSON editor"
      spellCheck={false}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
  return (
    <>
      <aside>
        <strong>◈ ChainXray</strong>
        <small>SECURITY WORKBENCH</small>
        {pages.map((p) => (
          <button
            key={p}
            className={p === page ? "on" : ""}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => navigate(p)}
          >
            {pageLabels[p] || p}
          </button>
        ))}
        <details className="advanced-nav"><summary>Advanced tools</summary>{advancedPages.map(p => <button key={p} className={p === page ? 'on' : ''} aria-current={p === page ? 'page' : undefined} onClick={() => navigate(p)}>{pageLabels[p] || p}</button>)}</details>
      </aside>
      <main>
        <header>
          {button("Open Browser", () => run("browser_open"))}
          <span>{lab.running ? "● Local lab running" : "Ethereum Sepolia capture"}</span>
          <span>Wallet network is controlled by your wallet</span>
          <span>
            {state.devnet
              ? "Devnet " + state.devnet + " · confirmation required"
              : "Forward sends requests to your wallet"}
          </span>
        </header>
        <div className="content-area">
        <small>{workspace || "NO WORKSPACE"} / WORKBENCH</small>
        <h1 style={{padding:0}}>{pageLabels[page] || page}</h1>
        <div className="target">
          {['Home', 'Repeater', 'Simulator', 'Intruder', 'Frames'].includes(page) ? 'Local lab target · ' + (lab.target || 'No contract deployed') : 'Capture and inspect wallet requests · Ethereum Sepolia'}
        </div>
        {(page === "Workspace setup" || !workspace) && (
          <section>
            <h2>Open a local workspace</h2>
            <p>A workspace saves your captured requests and debugging results on this device. Choose a name to begin or reopen a previous workspace.</p>
            <input
              list="names"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <datalist id="names">
              {state.workspaces.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </datalist>
            {button("Create or reopen", () => run("open", { name }))}
            {workspace && button("Close", () => run("close"))}
          </section>
        )}
        {workspace && (
          <>
            {page === "Intercept" && <InterceptPanel onRepeater={(tx:any) => { setDraft(pretty(tx)); setPage("Repeater"); setSelected(null); setNotice("Copied to Repeater. Original request remains held in Intercept."); }} />}
            {page === 'Request Flow' && <RequestFlow rows={rows} api={api} onRefresh={refresh} onRepeater={(tx:any) => { setDraft(pretty(tx)); setPage('Repeater'); setSelected(null); }}/>}
            {page === "Home" && (
              <>
                <section>
                  <small>ISOLATED EVM</small>
                  <h2>Vulnerable vault lab</h2>
                  <p>
                    Start the chain, deploy the vault, then capture a takeover
                    request. Open the request in Repeater to inspect the owner
                    change.
                  </p>
                  {button(lab.running ? "Stop chain" : "Start chain", () =>
                    run(lab.running ? "stop" : "start"),
                  )}
                  {lab.running && <p>MetaMask network: ChainXray Local · RPC: <code>{lab.rpcUrl}</code> · Chain ID: 31337 · Symbol: ETH. The RPC port changes each time you restart the lab.</p>}
                  {button("Deploy vault", () => run("deploy"))}
                  {button("Capture takeover", () => run("example"))}
                  {lab.running && button("Snapshot", () => run("snapshot"))}
                  {lab.running &&
                    button("Create funded account", () => run("account"))}
                  {lab.running &&
                    button("Reset to snapshot", () => run("reset"))}
                </section>
                <section>
                  <h2>Recent evidence</h2>
                  {list(rows.slice(0, 8))}
                </section>
              </>
            )}
            {page === "Web3 History" && (
              <section>
                <h2>Provider request history</h2><p>Intercepted requests and Forward/Drop decisions are saved automatically. Open Request Flow for supported wallet outcomes and manual receipt/trace reads. Each entry keeps the address used at capture time; switching wallets does not rewrite older entries.</p>
                {button("Pair browser capture", async () => {
                  const code = await api("pair");
                  prompt(
                    "Paste this 15-minute capture link into the ChainXray extension",
                    code,
                  );
                })}
                {button("Refresh history", refresh)}
                {editor}
                {action("Record request", "capture")}
                <input
                  aria-label="Import capture JSON"
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    try {
                      const f = e.target.files?.[0];
                      if (f && f.size < 8e6) {
                        const input = JSON.parse(await f.text());
                        for (const p of Array.isArray(input) ? input : [input])
                          await api("capture", p);
                        await refresh();
                      }
                    } catch (err) {
                      setNotice(String(err));
                    }
                  }}
                />
                {list(rows.filter((r) => r.kind === "capture"))}
              </section>
            )}
            {[
              "Decoder",
              "Repeater",
              "Simulator",
              "Intruder",
              "Scanner",
              "Contracts",
              "Frames",
            ].includes(page) && (
              <section>
                <h2>
                  {
                    {
                      Repeater: "Edit an unsigned transaction",
                      Decoder: "Decode ABI and calldata",
                      Simulator: "Simulate against a snapshot",
                      Intruder: "Run up to 32 transaction cases",
                      Scanner: "Run deterministic Web3 rules",
                      Contracts: "Register local ABI · {address, abi}",
                      Frames: "Local frame admission",
                    }[page]
                  }
                </h2>
                {["Repeater", "Simulator"].includes(page) && fields}
                {page === 'Repeater' && <div>{button('Edit Uniswap recipient',async()=>{const recipient=prompt('New recipient address');if(recipient)setDraft(pretty(await api('uniswap_mutate',{transaction:JSON.parse(draft),changes:{recipient}})));})}{button('Edit Uniswap minimum output',async()=>{const amountOutMinimum=prompt('Minimum output in raw token units');if(amountOutMinimum!==null)setDraft(pretty(await api('uniswap_mutate',{transaction:JSON.parse(draft),changes:{amountOutMinimum}})));})}<p>Swap edits only change this draft. Replay requires matching router, pools and balances on the local chain; the vault lab does not contain Uniswap contracts.</p></div>}
                {editor}
                {action(
                  "Run " + page,
                  {
                    Decoder: "decode",
                    Repeater: "simulate",
                    Simulator: "simulate",
                    Intruder: "campaign",
                    Scanner: "scan",
                    Contracts: "abi",
                    Frames: "frame",
                  }[page],
                )}
                {page === "Frames" &&
                  state.devnet &&
                  button("Submit signed frame to devnet", () => {
                    const raw = prompt(
                      "Signed 0x06 frame transaction for devnet " +
                        state.devnet,
                    );
                    if (raw) {
                      const confirmation = prompt(
                        "Type SUBMIT " + state.devnet + " to broadcast",
                      );
                      if (confirmation)
                        return run("submit", { raw, confirmation });
                    }
                  })}
                {page === "Intruder" && (
                  <button
                    onClick={() => api("cancel").catch((e) => setNotice(String(e)))}
                  >
                    Cancel campaign
                  </button>
                )}
              </section>
            )}
            {page === "Sessions" && (
              <section>
                {Array.from(new Set(rows.map((r) => r.session))).map(
                  (s: any) => (
                    <details key={s}>
                      <summary>{s}</summary>
                      {list(rows.filter((r) => r.session === s))}
                    </details>
                  ),
                )}
              </section>
            )}
            {page === "Findings" && (
              <section>
                <h2>
                  Deterministic findings
                </h2>
                {list(findings)}
                {button("Run vault reproduction", () => run("reproduce"))}
              </section>
            )}
            {page === "Reports" && (
              <section>
                <h2>Export workspace evidence</h2>
                {button("Save JSON archive", () =>
                  save(name + ".json", pretty(rows)),
                )}
                {button("Save Markdown", () =>
                  save(name + ".md", markdown(workspace, rows)),
                )}
                <p>Restore a JSON archive into this workspace</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    try {
                      const f = e.target.files?.[0];
                      if (f && f.size < 8e6)
                        await run("restore", {
                          rows: JSON.parse(await f.text()),
                        });
                    } catch (err) {
                      setNotice(String(err));
                    }
                  }}
                />
              </section>
            )}
            {page === 'Shared Findings' && <SharedFindings rows={rows}/>}
            {page === 'Shared Findings' && <section><ArkivSettings api={api}/></section>}
            {page === 'Uniswap API' && <UniswapPanel api={api} rows={rows} onEvidence={async()=>{await refresh();}}/>}
            {page === 'Live Dapps' && <LiveDapps api={api} onNavigate={navigate}/>}
          </>
        )}
        {selected && (
          <section>
            <small>EVIDENCE / {selected.id}</small>
            <h2>{selected.kind}</h2>
            {selected.kind === "capture" &&
              selected.input?.params?.[0] &&
              typeof selected.input.params[0] === "object" &&
              !Array.isArray(selected.input.params[0]) &&
              button("Send to Repeater", () => {
                setDraft(
                  pretty({
                    ...selected.input.params[0],
                    sourceEvidence: selected.id,
                  }),
                );
                setPage("Repeater");
                setSelected(null);
              })}
            {selected.kind === "capture" &&
              (!selected.input?.params?.[0] ||
                typeof selected.input.params[0] !== "object") && (
                <p>This provider call has no editable transaction envelope.</p>
              )}
            {selected.kind === "frame" &&
              button("Download replay test", () =>
                save("frame-replay.mjs", selected.output.test),
              )}
              <Evidence row={selected} />
            <pre>{pretty(selected)}</pre>
          </section>
        )}
        </div>
        <footer role="status">
          {busy ? "Working…" : notice || "Engine ready"}
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

