import { intro, outro, select, text, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { Lanes } from "../ui/stream.js";
import { parseArgs } from "../util/args.js";
import { runArchitect } from "../agents/architect.js";
import { runBuilder } from "../agents/builder.js";
import { recommendChain } from "../chains/recommend.js";
import type { ChainId } from "../chains/registry.js";

export async function cmdBuild(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("build");

  const brief = args.brief ?? (await text("brief", "a yield vault on Base"));

  const suggested = recommendChain(brief);
  step(`suggested chain ${c.bold(suggested.id)}  ${c.faint(suggested.why)}`);

  const chain = (await select<ChainId>("pick a chain", [
    { value: suggested.id, label: suggested.id, hint: "suggested" },
    { value: "base", label: "base", hint: "consumer onboarding" },
    { value: "arbitrum", label: "arbitrum", hint: "defi composability" },
    { value: "optimism", label: "optimism", hint: "public goods" },
    { value: "mainnet", label: "mainnet", hint: "cheap + secure" },
  ])) as ChainId;

  const lanes = new Lanes([
    { key: "architect", label: "architect", status: "idle", detail: "pending" },
    { key: "contracts", label: "contracts", status: "idle", detail: "pending" },
    { key: "tests", label: "tests", status: "idle", detail: "pending" },
    { key: "frontend", label: "frontend", status: "idle", detail: "pending" },
  ]);

  lanes.update("architect", { status: "run", detail: "loading ship/ concepts/ l2s/" });
  const plan = await runArchitect({ brief, chain });
  lanes.update("architect", { status: "done", detail: `${plan.contracts} contracts · ${plan.template}` });

  lanes.update("contracts", { status: "run", detail: "loading security/ addresses/" });
  const build = await runBuilder({ brief, chain, plan });
  lanes.update("contracts", { status: "done", detail: `${build.contracts.length} files` });
  lanes.update("tests", { status: "done", detail: `${build.tests} foundry tests` });
  lanes.update("frontend", { status: "done", detail: `scaffold-eth 2 · ${build.pages} pages` });

  done("project scaffolded");
  outro(`${c.faint("next")}  ${c.bold("eth audit")}  ${c.faint("then")}  ${c.bold("eth ship")}`);
}
