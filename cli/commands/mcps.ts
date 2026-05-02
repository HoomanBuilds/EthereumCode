import { c } from "../ui/theme.js";
import { emit } from "../util/output.js";
import { getMcps } from "../data/loader.js";

export async function cmdMcps(argv: string[]): Promise<void> {
  if (argv[0] === "--help") {
    console.log("usage: eth mcps [list|install <name>]");
    return;
  }
  const mcps = await getMcps();
  if (argv[0] === "install" && argv[1]) {
    const m = mcps.find(x => x.name === argv[1]);
    if (!m) { throw new Error(`unknown mcp: ${argv[1]}`); }
    const snippet = {
      mcpServers: {
        [m.name]: m.transport === "stdio"
          ? { command: "npx", args: ["-y", m.repo] }
          : { url: m.repo },
      },
    };
    console.log(JSON.stringify(snippet, null, 2));
    return;
  }
  emit(
    () => {
      for (const m of mcps) {
        console.log(`  ${c.bold(m.name.padEnd(24))} ${c.faint(m.transport.padEnd(6))} ${m.description}`);
      }
    },
    { command: "mcps", count: mcps.length, mcps }
  );
}
