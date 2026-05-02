import { emit } from "../util/output.js";
import { c } from "../ui/theme.js";

const COMMANDS: Record<string, string> = {
  new: "guided flow: idea -> build -> ship",
  idea: "generate a fundable ethereum idea",
  build: "contracts + frontend from a brief",
  audit: "security pass before you ship",
  ship: "deploy + verify + launch pack",
  raise: "deck + investor map for your round",
  doctor: "verify your toolchain",
  init: "install skills into ~/.claude and ~/.codex",
  search: "search repos, skills, mcps",
  repos: "browse and clone ethereum repos",
  skills: "list or show bundled skills",
  mcps: "list or install mcp servers",
  copilot: "freeform ethereum dev assistant",
  feedback: "send feedback to the team",
  telemetry: "manage telemetry data",
  uninstall: "remove skills and config",
  completion: "generate shell completions",
};

const GLOBAL_FLAGS = "--help --version --agent";

function bashScript(): string {
  const cmds = Object.keys(COMMANDS).join(" ");
  return [
    "# ethereum.new bash completion",
    "_eth() {",
    '  local cur="${COMP_WORDS[COMP_CWORD]}"',
    '  local prev="${COMP_WORDS[COMP_CWORD-1]}"',
    `  local commands="${cmds}"`,
    `  local flags="${GLOBAL_FLAGS}"`,
    "",
    "  case \"$prev\" in",
    "    repos)",
    '      COMPREPLY=( $(compgen -W "--category --clone $flags" -- "$cur") )',
    "      return",
    "      ;;",
    "    --category)",
    '      COMPREPLY=( $(compgen -W "defi-primitives accounts-aa infra l2-frameworks zk indexing mev tooling" -- "$cur") )',
    "      return",
    "      ;;",
    "    skills)",
    '      COMPREPLY=( $(compgen -W "show $flags" -- "$cur") )',
    "      return",
    "      ;;",
    "    mcps)",
    '      COMPREPLY=( $(compgen -W "install $flags" -- "$cur") )',
    "      return",
    "      ;;",
    "    telemetry)",
    '      COMPREPLY=( $(compgen -W "show clear disable enable" -- "$cur") )',
    "      return",
    "      ;;",
    "    config)",
    '      COMPREPLY=( $(compgen -W "show set unset" -- "$cur") )',
    "      return",
    "      ;;",
    "  esac",
    "",
    '  COMPREPLY=( $(compgen -W "$commands $flags" -- "$cur") )',
    "}",
    "complete -o default -F _eth eth",
  ].join("\n");
}

function zshScript(): string {
  const cmdEntries = Object.entries(COMMANDS)
    .map(([k, v]) => `    '${k}:${v}'`)
    .join("\n");
  return [
    "# ethereum.new zsh completion",
    "_eth() {",
    "  local -a commands",
    "  commands=(",
    cmdEntries,
    "  )",
    "",
    "  _arguments -C \\",
    "    '1:command:->cmds' \\",
    "    '*::arg:->args'",
    "",
    '  case "$state" in',
    "    cmds)",
    "      _describe -t commands 'eth command' commands",
    "      ;;",
    "    args)",
    '      case "${words[1]}" in',
    "        repos)",
    "          _arguments '--category[Filter by category]:category:_values category defi-primitives accounts-aa infra l2-frameworks zk indexing mev tooling' '--clone[Clone a repo]:slug:' '--agent[Machine-readable output]'",
    "          ;;",
    "        skills)",
    "          _arguments '1:action:_values action list show' '--agent[Machine-readable output]'",
    "          ;;",
    "        mcps)",
    "          _arguments '1:action:_values action list install' '--agent[Machine-readable output]'",
    "          ;;",
    "        telemetry)",
    "          _arguments '1:action:_values action show clear disable enable'",
    "          ;;",
    "        copilot)",
    "          _arguments '--agent[Machine-readable output]' '*:topic:'",
    "          ;;",
    "        *)",
    "          _arguments '--agent[Machine-readable output]'",
    "          ;;",
    "      esac",
    "      ;;",
    "  esac",
    "}",
    "compdef _eth eth",
  ].join("\n");
}

export async function cmdCompletion(argv: string[]): Promise<void> {
  if (argv[0] === "--help") {
    console.log("usage: eth completion [bash|zsh]");
    return;
  }
  const shell = argv.find((a) => a === "bash" || a === "zsh")
    ?? (process.env.SHELL?.includes("zsh") ? "zsh" : "bash");

  const output = shell === "zsh" ? zshScript() : bashScript();

  emit(
    () => {
      console.log(c.faint(`  # ethereum.new ${shell} completion`));
      console.log(c.faint(`  # save with: eth completion ${shell} > _eth`));
      console.log(output);
      console.log("");
    },
    { command: "completion", shell, script: output },
  );
}
