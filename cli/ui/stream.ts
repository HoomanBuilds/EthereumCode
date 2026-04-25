import { c, g, laneColor } from "./theme.js";

// Multi-lane agent status view. Each lane is one agent; each line is one "beat".
// The point is transparency: the user sees skills lighting up live, not a fake bar.

export type LaneStatus = "idle" | "run" | "done" | "err";

export interface Lane {
  key: string;
  label: string;
  status: LaneStatus;
  detail?: string;
}

export class Lanes {
  private lanes: Map<string, Lane> = new Map();
  private printed = 0;

  constructor(initial: Lane[] = []) {
    for (const l of initial) this.lanes.set(l.key, l);
  }

  add(lane: Lane): void {
    this.lanes.set(lane.key, lane);
    this.render();
  }

  update(key: string, patch: Partial<Lane>): void {
    const cur = this.lanes.get(key);
    if (!cur) return;
    this.lanes.set(key, { ...cur, ...patch });
    this.render();
  }

  private render(): void {
    if (this.printed > 0) {
      // Move up and clear previous frame.
      process.stdout.write(`\x1b[${this.printed}A`);
      for (let i = 0; i < this.printed; i++) {
        process.stdout.write("\x1b[2K\n");
      }
      process.stdout.write(`\x1b[${this.printed}A`);
    }
    let lines = 0;
    for (const lane of this.lanes.values()) {
      const color = laneColor(lane.status);
      const glyph = lane.status === "run" ? g.ring : lane.status === "done" ? g.tick : lane.status === "err" ? g.cross : g.idle;
      const head = `  ${color(glyph)} ${c.bold(lane.label.padEnd(12))}`;
      const tail = lane.detail ? c.faint(`  ${g.chevron} ${lane.detail}`) : "";
      process.stdout.write(head + tail + "\n");
      lines++;
    }
    this.printed = lines;
  }
}

export function beat(label: string, detail?: string): void {
  const body = detail ? `${label}  ${c.faint(g.chevron)}  ${c.faint(detail)}` : label;
  process.stdout.write(`  ${c.faint(g.dot)} ${body}\n`);
}
