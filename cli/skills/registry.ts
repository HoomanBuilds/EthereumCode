// task → ethskills routing table.
// Skills are bundled locally in ./skills at the repo root. No runtime fetching, no
// base URLs. Adding a skill costs context, so only load what each task actually needs.

export type TaskKey =
  | "architect"
  | "build.contracts"
  | "build.frontend"
  | "audit"
  | "ship"
  | "idea";

// Bundled skill slugs. Must match a file `skills/<slug>.md` at the repo root.
export type SkillSlug =
  | "ship"
  | "concepts"
  | "l2s"
  | "standards"
  | "why"
  | "security"
  | "tools"
  | "addresses"
  | "gas"
  | "testing"
  | "frontend-ux"
  | "frontend-playbook"
  | "wallets"
  | "orchestration"
  | "audit"
  | "qa"
  | "building-blocks"
  | "indexing"
  | "noir"
  | "protocol";

export const SKILLS: Record<TaskKey, SkillSlug[]> = {
  architect: ["ship", "concepts", "l2s", "standards", "why"],
  "build.contracts": ["security", "tools", "addresses", "standards", "gas", "testing", "building-blocks"],
  "build.frontend": ["frontend-ux", "frontend-playbook", "wallets", "orchestration"],
  audit: ["audit", "security"],
  ship: ["qa", "ship", "l2s"],
  idea: ["why", "concepts", "l2s"],
};
