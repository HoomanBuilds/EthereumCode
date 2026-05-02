import Anthropic from "@anthropic-ai/sdk";
import { loadSkillsFor, packSkills } from "../skills/loader.js";
import type { TaskKey } from "../skills/registry.js";
import { loadConfig } from "../util/env.js";
import { readContext, serialize } from "../handoff/context.js";

// The single chokepoint for every Claude invocation.
// Rules enforced here:
//   1. The relevant ethskills SKILL.md files are loaded and injected as system context
//      before the task-specific prompt.
//   2. If no API key is configured, we degrade gracefully to a local stub so the CLI
//      still demos the shape of the flow without hallucinating code.
//   3. Opus 4.6 for architecture-grade tasks, Sonnet for iteration.
//   4. When `withContext` is true, the current .ethereum-code/idea-context.md is
//      prepended to the system prompt so agents see prior phase output.

export type Tier = "architect" | "iterate";

const MODEL: Record<Tier, string> = {
  architect: "claude-opus-4-5-20250929",
  iterate: "claude-sonnet-4-5-20250929",
};

export interface AgentCall {
  task: TaskKey;
  tier: Tier;
  system: string;
  prompt: string;
  maxTokens?: number;
  withContext?: boolean;
}

export interface AgentResult {
  text: string;
  grounded: boolean;
  skills: string[];
  stub: boolean;
}

let _client: Anthropic | null = null;
async function client(): Promise<Anthropic | null> {
  if (_client) return _client;
  const cfg = await loadConfig();
  const apiKey = process.env.ANTHROPIC_API_KEY ?? cfg.anthropicKey;
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function invoke(call: AgentCall): Promise<AgentResult> {
  let system = call.system;
  if (call.withContext) {
    const ctx = await readContext();
    if (ctx) {
      system = `# Project context (read-only)\n\n${serialize(ctx)}\n\n---\n\n${system}`;
    }
  }
  const skills = await loadSkillsFor(call.task);
  const grounding = packSkills(skills);
  const fullSystem = `${grounding}\n\n---\n\n${system}`;
  const skillSlugs = skills.map((s) => s.slug);
  const api = await client();
  if (!api) {
    return {
      text: stub(call),
      grounded: true,
      skills: skillSlugs,
      stub: true,
    };
  }
  const res = await api.messages.create({
    model: MODEL[call.tier],
    max_tokens: call.maxTokens ?? 4096,
    system: fullSystem,
    messages: [{ role: "user", content: call.prompt }],
  });
  const text = res.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, grounded: true, skills: skillSlugs, stub: false };
}

// Deterministic stub used when ANTHROPIC_API_KEY is missing. Not magical — the point is
// to show the founder exactly what shape the real output will take, so they can wire
// their key and re-run without guessing.
function stub(call: AgentCall): string {
  return [
    `# stub: ${call.task}`,
    "",
    "no ANTHROPIC_API_KEY set — showing the shape of the real output.",
    "run `eth doctor` to configure, then re-run this command.",
    "",
    "## prompt",
    call.prompt.slice(0, 400),
  ].join("\n");
}
