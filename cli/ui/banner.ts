import { c, g } from "./theme.js";

// Minimal wordmark. The ASCII is small on purpose — every pixel earns its place.
export function banner(): string {
  const title = c.bold("ethereum-code");
  const tag = c.faint("idea → build → ship → audit → raise");
  const bar = c.faint(g.dash.repeat(42));
  return [bar, `  ${title}  ${c.dim(g.chevron)}  ${tag}`, bar].join("\n");
}

export function tinyBanner(): string {
  return c.bold("eth") + c.faint(".code");
}
