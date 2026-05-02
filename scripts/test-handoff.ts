import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "eth-handoff-"));
  process.chdir(dir);

  const { appendSection, readContext } = await import(resolve(import.meta.dirname, "../cli/handoff/context.js"));

  await appendSection("Idea", "Test idea body\n\nThis is a test.");
  let ctx = await readContext();
  if (!ctx) throw new Error("context not created after appendSection");
  if (!ctx.sections["Idea"]) throw new Error("Idea section missing");
  if (!ctx.sections["Idea"].includes("Test idea body")) throw new Error("Idea body not persisted");

  await appendSection("Idea", "Second idea addition.");
  ctx = await readContext();
  if (!ctx) throw new Error("context missing after second append");
  if (!ctx.sections["Idea"].includes("Second idea addition")) throw new Error("second append failed");
  if (!ctx.sections["Idea"].includes("Test idea body")) throw new Error("original content lost after append");

  await appendSection("Open questions", "- What is the moat?");
  ctx = await readContext();
  if (!ctx) throw new Error("context missing");
  if (!ctx.sections["Open questions"]) throw new Error("Open questions section missing");

  await appendSection("Architecture", "Architecture body with chain: base");
  ctx = await readContext();
  if (!ctx.sections["Architecture"]) throw new Error("Architecture section missing");
  if (!ctx.sections["Architecture"].includes("chain: base")) throw new Error("Architecture body not persisted");

  await appendSection("Audit findings", "High: reentrancy in deposit()");
  ctx = await readContext();
  if (!ctx.sections["Audit findings"]) throw new Error("Audit findings section missing");

  await appendSection("Ship status", "Deployed at 0xabc on base sepolia");
  ctx = await readContext();
  if (!ctx.sections["Ship status"]) throw new Error("Ship status section missing");

  const raw = await readFile(join(dir, ".ethereum.new", "idea-context.md"), "utf8");
  if (!raw.includes("---")) throw new Error("frontmatter missing");
  if (!raw.includes("slug:")) throw new Error("slug frontmatter missing");
  if (!raw.includes("chain:")) throw new Error("chain frontmatter missing");
  if (!raw.includes("phase:")) throw new Error("phase frontmatter missing");

  const noCtx = await readContext();
  if (!noCtx) throw new Error("context should exist from prior appends");

  await rm(dir, { recursive: true, force: true });
  console.log("✓ handoff e2e ok");
}

main().catch(e => { console.error(e); process.exit(1); });
