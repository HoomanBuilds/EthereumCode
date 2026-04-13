import { intro, outro, select, step, done } from "../ui/prompt.js";
import { c } from "../ui/theme.js";
import { parseArgs } from "../util/args.js";
import { runReviewer } from "../agents/reviewer.js";
import { deploy } from "../deploy/deploy.js";
import { writeProjectFile } from "../util/fs.js";

export async function cmdShip(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  intro("ship");

  const target = args.testnet
    ? "testnet"
    : args.mainnet
      ? "mainnet"
      : await select<"testnet" | "mainnet">("deploy target", [
          { value: "testnet", label: "testnet", hint: "base sepolia" },
          { value: "mainnet", label: "mainnet", hint: "real funds" },
        ]);

  step("reviewer qa pass");
  const review = await runReviewer();
  if (!review.ok) {
    throw new Error(`reviewer blocked: ${review.reason}`);
  }
  done("qa green");

  step(`deploying to ${c.bold(target)}`);
  const result = await deploy({ target });
  done(`contract at ${c.bold(result.address)}`);

  step("generating launch pack");
  await writeProjectFile("launch/tweet.md", result.tweet);
  await writeProjectFile("launch/ph.md", result.ph);
  await writeProjectFile("launch/frame.md", result.frame);
  done("launch pack written to ./launch");

  outro(`${c.faint("shipped.")}  ${c.bold(result.url)}`);
}
