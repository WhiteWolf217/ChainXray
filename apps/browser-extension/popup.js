async function operate(start) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    args: [start],
    func: (begin) => {
      const key = Symbol.for("chainxray.capture");
      if (!begin) {
        const s = window[key];
        if (!s) return [];
        s.provider.request = s.original;
        delete window[key];
        return s.rows;
      }
      if (window[key]) return "Already capturing";
      const provider = window.ethereum;
      if (!provider) return "No wallet provider in this tab";
      const original = provider.request;
      const rows = [];
      provider.request = async function (request) {
        const allowed =
          /^(eth_(chainId|accounts|call|estimateGas|sendTransaction|sendRawTransaction|signTypedData_v4|getLogs|getTransactionReceipt)|personal_sign|wallet_switchEthereumChain)$/.test(
            request.method,
          );
        const entry = allowed
          ? JSON.parse(
              JSON.stringify({
                method: request.method,
                params: request.params ?? [],
                time: new Date().toISOString(),
              }),
            )
          : null;
        try {
          const value = await original.call(this, request);
          if (entry) entry.response = value;
          return value;
        } catch (error) {
          if (entry) entry.error = String(error);
          throw error;
        } finally {
          if (entry && rows.length < 500) rows.push(entry);
        }
      };
      window[key] = { provider, original, rows };
      return "Capturing up to 500 provider calls";
    },
  });
  if (start) return result;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(result)]));
  a.download = "provider-session.json";
  a.click();
  const pairing = document.getElementById("pair").value.trim();
  if (pairing) {
    const url = new URL(pairing);
    if (
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      !/^#[a-f0-9]{64}$/.test(url.hash)
    )
      throw Error("Invalid local pairing link");
    for (const row of result) {
      const response = await fetch(url.origin + "/api", {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: "Bearer " + url.hash.slice(1),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "capture", payload: row }),
      });
      if (!response.ok)
        throw Error("Import stopped. The capture is saved in your downloads.");
    }
    return "Sent " + result.length + " requests to the workspace";
  }
  return "Exported " + result.length + " requests";
}
for (const id of ["start", "save"])
  document.getElementById(id).onclick = async () => {
    try {
      document.getElementById("status").textContent = await operate(
        id === "start",
      );
    } catch (e) {
      document.getElementById("status").textContent = String(e);
    }
  };
