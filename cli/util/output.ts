let agentMode = false;

export function setAgentMode(on: boolean): void {
  agentMode = on;
}

export function isAgent(): boolean {
  return agentMode;
}

export function emit(human: () => void, machine: object): void {
  if (agentMode) {
    process.stdout.write(JSON.stringify(machine) + "\n");
    return;
  }
  human();
}
