import { invoke } from "./runtime.js";

export interface ReviewResult {
  ok: boolean;
  reason?: string;
  markdown: string;
}

// Pre-ship QA. Runs the ethskills qa checklist as a fresh agent — never the same
// agent that built the code.
export async function runReviewer(): Promise<ReviewResult> {
  const res = await invoke({
    task: "ship",
    tier: "architect",
    system:
      "You are the pre-ship reviewer. Run the ethskills QA checklist strictly. " +
      "Block on: unverified contract, hardcoded secrets, missing three-button flow, " +
      "infinite approvals, placeholder branding, unhandled network errors, missing event emissions.",
    prompt:
      "Return 'OK' on the first line if safe to ship. Otherwise return 'BLOCK: <reason>' on the first line. Then the full checklist result.",
  });

  const first = res.text.split("\n")[0] ?? "";
  if (first.startsWith("BLOCK")) {
    return { ok: false, reason: first.replace(/^BLOCK:\s*/, ""), markdown: res.text };
  }
  return { ok: true, markdown: res.text };
}
