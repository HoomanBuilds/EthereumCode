import { banner } from "../ui/banner.js";
import { intro, outro, text, select, note, warnApiKey } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { cmdIdea } from "./idea.js";
import { cmdBuild } from "./build.js";
import { cmdAudit } from "./audit.js";
import { cmdShip } from "./ship.js";
import { cmdRaise } from "./raise.js";

export async function cmdNew(_argv: string[]): Promise<void> {
  await warnApiKey();
  console.log(banner());
  console.log("");
  intro("what are you building?");

  const brief = await text(
    "describe it in one sentence",
    "a yield vault on Base for stablecoin LPs",
  );

  note(
    "brief",
    `  ${c.bold(brief)}\n  ${c.faint("we'll ground every step in ethskills before writing a line of code.")}`,
  );

  const route = await select<"full" | "idea" | "build" | "audit" | "ship" | "raise">(
    "where do you want to start?",
    [
      { value: "full", label: "full flow", hint: "idea → build → audit → ship → raise" },
      { value: "idea", label: "idea only", hint: "one-pager, why now, who for" },
      { value: "build", label: "build", hint: "contracts + frontend" },
      { value: "audit", label: "audit", hint: "slither + ethskills checklist" },
      { value: "ship", label: "ship", hint: "deploy + verify + gtm" },
      { value: "raise", label: "raise", hint: "deck + investor map" },
    ],
  );

  const args = ["--brief", brief];
  switch (route) {
    case "idea":
      await cmdIdea(args);
      break;
    case "build":
      await cmdBuild(args);
      break;
    case "audit":
      await cmdAudit(args);
      break;
    case "ship":
      await cmdShip(args);
      break;
    case "raise":
      await cmdRaise(args);
      break;
    case "full":
      await cmdIdea(args);
      await cmdBuild(args);
      await cmdAudit(args);
      await cmdShip(args);
      await cmdRaise(args);
      break;
  }

  outro("done.");
}
