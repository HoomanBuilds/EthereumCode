import * as p from "@clack/prompts";
import { c, g } from "./theme.js";
import { loadConfig } from "../util/env.js";

let warnedApiKey = false;

export async function warnApiKey(): Promise<void> {
  if (warnedApiKey) return;
  warnedApiKey = true;
  const cfg = await loadConfig();
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY ?? cfg.anthropicKey);
  if (!hasKey) {
    process.stdout.write(`\n  ${c.warn(g.dot)} no anthropic api key — running in stub mode. set ${c.bold("ANTHROPIC_API_KEY")} or run ${c.bold("eth doctor --init")} to configure\n\n`);
  }
}

// Thin wrapper around @clack/prompts so every prompt in the CLI shares one voice.
// Rules: no filler words, no emoji, no "please".

export async function text(message: string, placeholder?: string, initialValue?: string): Promise<string> {
  const res = await p.text({
    message,
    placeholder,
    initialValue,
    validate: (v) => (v.trim().length === 0 ? "required" : undefined),
  });
  if (p.isCancel(res)) cancel();
  return res as string;
}

export async function select<T extends string>(
  message: string,
  options: { value: T; label: string; hint?: string }[],
): Promise<T> {
  const res = await p.select({ message, options });
  if (p.isCancel(res)) cancel();
  return res as T;
}

export async function confirm(message: string, initialValue = true): Promise<boolean> {
  const res = await p.confirm({ message, initialValue });
  if (p.isCancel(res)) cancel();
  return res as boolean;
}

export function intro(line: string): void {
  p.intro(c.bold(line));
}

export function outro(line: string): void {
  p.outro(c.faint(line));
}

export function note(title: string, body: string): void {
  p.note(body, title);
}

export function step(label: string): void {
  process.stdout.write(`  ${c.accent(g.dot)} ${label}\n`);
}

export function done(label: string): void {
  process.stdout.write(`  ${c.good(g.tick)} ${label}\n`);
}

export function fail(label: string): void {
  process.stdout.write(`  ${c.bad(g.cross)} ${label}\n`);
}

export function cancel(): never {
  p.cancel("aborted.");
  process.exit(0);
}

export const spinner = p.spinner;
