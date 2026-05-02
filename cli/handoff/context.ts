import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { IdeaContext, Phase } from "./types.js";

const CONTEXT_PATH = resolve(process.cwd(), ".ethereum.new", "idea-context.md");

function parse(md: string): IdeaContext | null {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const fm: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const [k, ...v] = line.split(":");
    if (k) fm[k.trim()] = v.join(":").trim();
  }
  const body = m[2]!;
  const sections: Record<string, string> = {};
  let current: string | null = null;
  let buf: string[] = [];
  for (const line of body.split("\n")) {
    const h = line.match(/^## (.+)$/);
    if (h) {
      if (current) sections[current] = buf.join("\n").trim();
      current = h[1]!.trim();
      buf = [];
    } else if (current) {
      buf.push(line);
    }
  }
  if (current) sections[current] = buf.join("\n").trim();
  return {
    slug: fm.slug ?? "",
    chain: fm.chain ?? "",
    phase: (fm.phase as Phase) ?? "idea",
    created: fm.created ?? "",
    updated: fm.updated ?? "",
    sections,
  };
}

export function serialize(ctx: IdeaContext): string {
  const fm = `---\nslug: ${ctx.slug}\nchain: ${ctx.chain}\nphase: ${ctx.phase}\ncreated: ${ctx.created}\nupdated: ${ctx.updated}\n---\n\n`;
  const body = Object.entries(ctx.sections)
    .map(([n, b]) => `## ${n}\n\n${b}\n`)
    .join("\n");
  return fm + body;
}

export async function readContext(): Promise<IdeaContext | null> {
  try {
    const md = await readFile(CONTEXT_PATH, "utf8");
    return parse(md);
  } catch {
    return null;
  }
}

export async function writeContext(ctx: IdeaContext): Promise<void> {
  await mkdir(resolve(process.cwd(), ".ethereum.new"), { recursive: true });
  ctx.updated = new Date().toISOString().slice(0, 10);
  await writeFile(CONTEXT_PATH, serialize(ctx));
}

export async function appendSection(name: string, body: string): Promise<void> {
  const existing = (await readContext()) ?? {
    slug: "untitled",
    chain: "base",
    phase: "idea" as Phase,
    created: new Date().toISOString().slice(0, 10),
    updated: new Date().toISOString().slice(0, 10),
    sections: {},
  };
  const phaseMap: Record<string, Phase> = {
    Idea: "idea",
    Architecture: "build",
    "Audit findings": "audit",
    "Ship status": "ship",
    "Raise results": "raise",
    "Open questions": existing.phase,
  };
  if (phaseMap[name]) existing.phase = phaseMap[name];
  const prev = existing.sections[name] ?? "";
  existing.sections[name] = prev ? `${prev}\n\n${body}` : body;
  await writeContext(existing);
}
