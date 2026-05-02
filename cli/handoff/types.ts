export type Phase = "idea" | "build" | "audit" | "ship" | "raise";

export interface IdeaContext {
  slug: string;
  chain: string;
  phase: Phase;
  created: string;
  updated: string;
  sections: Record<string, string>;
}
