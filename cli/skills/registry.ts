// task → ethskills routing table.
// Skills are bundled locally in ./skills at the repo root. No runtime fetching, no
// base URLs. Adding a skill costs context, so only load what each task actually needs.

export type TaskKey =
  | "architect"
  | "build.contracts"
  | "build.frontend"
  | "audit"
  | "ship"
  | "idea"
  | "idea.validate"
  | "idea.beginner"
  | "build.review"
  | "build.debug"
  | "build.frontend.design"
  | "launch.deck"
  | "launch.hackathon"
  | "launch.grant";

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
  | "protocol"
  | "eth-beginner"
  | "validate-idea"
  | "roast-my-product"
  | "design-taste"
  | "frontend-design-guidelines"
  | "debug-contract"
  | "page-load-animations"
  | "number-formatting"
  | "create-pitch-deck"
  | "submit-to-hackathon"
  | "apply-grant";

export const SKILLS: Record<TaskKey, SkillSlug[]> = {
  architect: ["ship", "concepts", "l2s", "standards", "why"],
  "build.contracts": ["security", "tools", "addresses", "standards", "gas", "testing", "building-blocks"],
  "build.frontend": ["frontend-ux", "frontend-playbook", "wallets", "orchestration"],
  audit: ["audit", "security"],
  ship: ["qa", "ship", "l2s"],
  idea: ["why", "concepts", "l2s"],
  "idea.validate": ["validate-idea", "why", "concepts"],
  "idea.beginner": ["eth-beginner", "concepts", "l2s"],
  "build.review": ["roast-my-product", "design-taste", "frontend-ux"],
  "build.debug": ["debug-contract", "tools", "testing"],
  "build.frontend.design": ["frontend-design-guidelines", "frontend-ux", "design-taste"],
  "launch.deck": ["create-pitch-deck", "why"],
  "launch.hackathon": ["submit-to-hackathon", "ship"],
  "launch.grant": ["apply-grant", "why"],
};
