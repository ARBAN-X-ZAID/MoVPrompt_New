// Agent registry — resolves a targetModel string to the correct expert agent.
// Specialists are tried first (most specific match wins); generic is the fallback.

import { klingAgent } from "./kling.ts";
import { seedanceAgent } from "./seedance.ts";
import { veoAgent } from "./veo.ts";
import { genericAgent } from "./generic.ts";

export interface ExpertAgent {
  id: string;
  displayName: string;
  matches: (targetModel: string) => boolean;
  docSummary: string;
  systemAddendum: string;
  examples: string;
}

const SPECIALISTS: ExpertAgent[] = [klingAgent, seedanceAgent, veoAgent];

export function getAgent(targetModel: string): ExpertAgent {
  const normalized = targetModel.toLowerCase();
  for (const agent of SPECIALISTS) {
    if (agent.matches(normalized)) return agent;
  }
  return genericAgent;
}
