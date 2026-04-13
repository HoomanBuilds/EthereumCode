import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { scanForSecrets } from "./env.js";

// Every file write goes through here. Enforces the "no secrets in diffs" rule.
export async function writeProjectFile(relPath: string, content: string): Promise<string> {
  const abs = resolve(process.cwd(), relPath);
  const hit = scanForSecrets(content);
  if (hit) {
    throw new Error(`refusing to write ${relPath}: possible secret leak (${hit}). move it to ~/.ethereum.new/config.toml.`);
  }
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
  return abs;
}

export async function readProjectFile(relPath: string): Promise<string | null> {
  const abs = resolve(process.cwd(), relPath);
  try {
    return await readFile(abs, "utf8");
  } catch {
    return null;
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
