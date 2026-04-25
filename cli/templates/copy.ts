import { mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChainId } from "../chains/registry.js";

// Copies a template directory into ./<slug> in the user's cwd.
// Substitutes a few lightweight tokens (chain id, chain name).

const here = dirname(fileURLToPath(import.meta.url));
// Templates live at repo root, two levels up from dist/cli/templates at runtime,
// so we resolve relative to module URL.
const TEMPLATES_ROOT = resolve(here, "..", "..", "templates");

export interface CopyResult {
  root: string;
  contracts: string[];
  tests: number;
  pages: number;
}

export async function copyTemplate(
  template: string,
  opts: { chain: ChainId; slug?: string },
): Promise<CopyResult> {
  const src = resolve(TEMPLATES_ROOT, template);
  const slug = opts.slug ?? template;
  const dst = resolve(process.cwd(), slug);

  await mkdir(dst, { recursive: true });

  const contracts: string[] = [];
  let tests = 0;
  let pages = 0;

  for await (const rel of walk(src)) {
    const from = join(src, rel);
    const to = join(dst, rel);
    await mkdir(dirname(to), { recursive: true });
    const raw = await readFile(from, "utf8");
    const content = raw.replaceAll("__CHAIN__", opts.chain);
    await writeFile(to, content, "utf8");

    if (rel.startsWith("src/") && rel.endsWith(".sol")) contracts.push(rel);
    if (rel.startsWith("test/") && rel.endsWith(".sol")) tests++;
    if (rel.startsWith("frontend/pages") || rel.startsWith("frontend/app")) pages++;
  }

  return { root: relative(process.cwd(), dst), contracts, tests, pages };
}

async function* walk(dir: string, base = ""): AsyncGenerator<string> {
  const entries = await readdir(dir).catch(() => []);
  for (const entry of entries) {
    const rel = base ? `${base}/${entry}` : entry;
    const full = join(dir, entry);
    const st = await stat(full);
    if (st.isDirectory()) {
      yield* walk(full, rel);
    } else {
      yield rel;
    }
  }
}
