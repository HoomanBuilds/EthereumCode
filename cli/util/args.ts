// Tiny arg parser. No dependency, no magic. Supports --key value and --bool.
export interface Args {
  brief?: string;
  chain?: string;
  testnet?: boolean;
  mainnet?: boolean;
  force?: boolean;
  [k: string]: string | boolean | undefined;
}

export function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!;
    if (!tok.startsWith("--")) continue;
    const key = tok.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i++;
  }
  return out;
}
