import { spawn } from "node:child_process";

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(cmd: string, args: string[] = [], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

export async function which(bin: string): Promise<{ ok: boolean; path?: string }> {
  const r = await run("which", [bin]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
  if (r.code === 0 && r.stdout.trim()) return { ok: true, path: r.stdout.trim() };
  return { ok: false };
}
