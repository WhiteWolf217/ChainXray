import React from "react";
export function Evidence({ row }: { row: any }) {
  const result = row.output ?? {};
  if(result.uniswap) return <div><h3>{result.uniswap.interface}: {result.functionName}</h3><p>{result.uniswap.note}</p><pre>{JSON.stringify(result.uniswap.parameters,null,2)}</pre><p>Amounts are raw token units.</p>{result.uniswap.warnings.map((s:string)=><p key={s}>{s}</p>)}</div>;
  if (result.boundaries)
    return (
      <>
        <h3>
          {result.admitted ? "Admitted" : "Rejected"} · {result.reason}
        </h3>
        <table>
          <thead>
            <tr>
              <th>Frame</th>
              <th>Mode</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {result.boundaries.map((f: any) => (
              <tr key={f.index}>
                <td>{f.index}</td>
                <td>{f.mode}</td>
                <td>
                  <code>{f.target}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  if (result.receipt)
    return (
      <>
        <h3>
          {result.finding ??
            (result.receipt.status === "0x1"
              ? "Execution succeeded"
              : "Execution reverted")}
        </h3>
        <p>
          {Number(result.receipt.gasUsed).toLocaleString()} gas ·{" "}
          {result.receipt.logs.length} event(s) · snapshot {result.snapshot}
        </p>
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(result.before).map((k) => (
              <tr key={k}>
                <td>{k}</td>
                <td>
                  <code>{result.before[k]}</code>
                </td>
                <td>
                  <code>{result.after[k]}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  if (result.functionName)
    return (
      <p>
        Decoded call · <strong>{result.functionName}</strong>
        {result.finding}
      </p>
    );
  if (result.results)
    return (
      <p>
        {result.results.length} mutation cases recorded ·{" "}
        {result.cancelled
          ? "Cancelled"
          : result.truncated
            ? "Time limit reached"
            : "Completed"}
      </p>
    );
  return null;
}
export function markdown(workspace: string, rows: any[]) {
  const findings = rows.filter((row) => row.output?.finding);
  const lines = [
    "# ChainXray investigation · " + workspace,
    "",
    "Local Anvil lab · chain 31337",
    "",
    rows.length + " evidence records · " + findings.length + " observations",
    "",
    "## Findings",
    "",
  ];
  for (const row of findings) {
    lines.push(
      "### " + row.output.finding,
      "",
      "Evidence: " + row.id,
      "",
      "Target: " +
        (row.output.to ?? row.input.params?.[0]?.to ?? "unspecified"),
      "",
    );
  }
  if (!findings.length) lines.push("No deterministic findings recorded.", "");
  lines.push(
    "## Reproduction",
    "",
    "Open the matching capture in Repeater. For the bundled vault deploy a fresh fixture, capture the takeover and run the edited request, then run the Forge reproduction from Findings.",
    "",
    "## Evidence",
    "",
  );
  for (const row of rows)
    lines.push(
      "### " + row.kind,
      "",
      row.time + " · " + row.id,
      "",
      "~~~~json",
      JSON.stringify(row, null, 2),
      "~~~~",
      "",
    );
  return lines.join("\n");
}
