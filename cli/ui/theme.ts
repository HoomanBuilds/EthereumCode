import pc from "picocolors";

// A small, quiet palette. Ethereum blue + graphite. No rainbows.
export const c = {
  accent: (s: string) => pc.cyan(s),
  faint: (s: string) => pc.gray(s),
  bold: (s: string) => pc.bold(s),
  dim: (s: string) => pc.dim(s),
  good: (s: string) => pc.green(s),
  warn: (s: string) => pc.yellow(s),
  bad: (s: string) => pc.red(s),
  label: (s: string) => pc.bold(pc.cyan(s)),
  kbd: (s: string) => pc.dim(pc.inverse(` ${s} `)),
};

// Glyphs. One per concept. Used sparingly.
export const g = {
  dot: "●",
  ring: "◉",
  arrow: "→",
  tick: "✓",
  cross: "✗",
  dash: "─",
  vbar: "│",
  corner: "└",
  tee: "├",
  chevron: "›",
  spark: "◆",
  idle: "○",
};

// Status lanes for multi-agent runs. Keep it tight.
export const laneColor = (status: "idle" | "run" | "done" | "err"): ((s: string) => string) => {
  switch (status) {
    case "idle":
      return c.faint;
    case "run":
      return c.accent;
    case "done":
      return c.good;
    case "err":
      return c.bad;
  }
};

export const rule = (width = 48): string => c.faint(g.dash.repeat(width));
