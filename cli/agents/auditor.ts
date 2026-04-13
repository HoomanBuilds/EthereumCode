import { invoke } from "./runtime.js";
import { run, which } from "../util/exec.js";

export interface AuditReport {
  highs: number;
  mediums: number;
  lows: number;
  markdown: string;
}

// The auditor is a separate agent on purpose — the ethskills audit skill explicitly
// warns that the agent that wrote the code should never audit its own code.
export async function runAuditor(): Promise<AuditReport> {
  let slitherOutput = "";
  const slither = await which("slither");
  if (slither.ok) {
    const r = await run("slither", [".", "--json", "-"]).catch(() => ({ stdout: "", stderr: "", code: 1 }));
    slitherOutput = r.stdout;
  }

  const res = await invoke({
    task: "audit",
    tier: "architect",
    system:
      "You are the auditor. Walk the ethskills audit checklist (500+ items across 19 domains). " +
      "Check CEI, reentrancy, access control, integer over/underflow, oracle manipulation, " +
      "front-running, signature replay, and delegatecall. Be severity-honest. No false positives for decoration.",
    prompt: [
      "Produce an audit report in markdown.",
      "Sections: summary, highs, mediums, lows, passed checks.",
      "Start with a one-line verdict. Then counts. Then findings, each with file:line and a one-line remediation.",
      "",
      "slither output:",
      slitherOutput || "(slither not run — install with `pip install slither-analyzer`)",
    ].join("\n"),
    maxTokens: 6000,
  });

  const markdown = res.text;
  const highs = countHeader(markdown, /^#+\s*highs?/im);
  const mediums = countHeader(markdown, /^#+\s*mediums?/im);
  const lows = countHeader(markdown, /^#+\s*lows?/im);

  return { highs, mediums, lows, markdown };
}

// Crude counter: number of list items under a section. Replaced with a real parser once
// the auditor output format stabilizes.
function countHeader(md: string, header: RegExp): number {
  const match = md.match(header);
  if (!match) return 0;
  const idx = match.index ?? 0;
  const after = md.slice(idx);
  const next = after.slice(1).match(/^#+\s/m);
  const slice = next ? after.slice(0, (next.index ?? 0) + 1) : after;
  return (slice.match(/^\s*[-*]\s/gm) ?? []).length;
}
