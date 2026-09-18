// Stage 2 of Director → Orchestrator: per-shot model routing.
//
// Pure function. Given a PlannedShot, a routing budget, and optional taste
// signals, returns the best model id with explanation. Reuses the existing
// `rankModels()` heuristic (built for a single-shot Director) and biases the
// outcome by the session-level budget axis.
//
// Design notes:
//  - User overrides win: if shot.locked.model_user_override is set, route
//    returns that model verbatim with source="override".
//  - Budget biases the cost dimension:
//      quality  → prefer high-cost / high-quality models (Veo, Kling Pro)
//      balanced → no bias (pure ranking score)
//      cheap    → prefer fast/cheap tier (Seedance-lite, LTX)
//  - The function is deterministic for a given input — easy to unit test.

import type { Breakdown } from "./api";
import { rankModels, type RankedModel } from "./modelRanking";
import { CATALOG_BY_ID, type ModelCapabilities } from "./videoModelCatalog";
import type { PlannedShot, RoutingBudget } from "./plan";

export type TasteSignals = {
  /** Models the user has historically liked — small score bump. */
  preferredModelIds?: string[];
  /** Models the user has historically rejected — small penalty. */
  avoidModelIds?: string[];
};

export type RouteDecision = {
  modelId: string;
  model: ModelCapabilities;
  source: "override" | "ranking";
  reasons: string[];
  alternatives: ModelCapabilities[];
};

const BUDGET_COST_WEIGHT: Record<RoutingBudget, Record<ModelCapabilities["cost"], number>> = {
  quality: { high: 2, mid: 0, low: -1 },
  balanced: { high: 0, mid: 0, low: 0 },
  cheap: { high: -2, mid: 0, low: 2 },
};

const BUDGET_SPEED_WEIGHT: Record<RoutingBudget, Record<ModelCapabilities["speed"], number>> = {
  quality: { slow: 0.5, balanced: 0, fast: -0.5 },
  balanced: { slow: 0, balanced: 0, fast: 0 },
  cheap: { slow: -1, balanced: 0, fast: 1 },
};

/** Convert a PlannedShot into the Breakdown shape that rankModels() expects. */
function shotToBreakdown(shot: PlannedShot): Breakdown {
  return {
    subject: "",
    action: "",
    mood: "",
    color_palette: "",
    environment: "",
    film_emulation: "",
    model_recommendation: "",
    duration_hint: shot.locked.duration_seconds ? `${shot.locked.duration_seconds}s` : "",
    // Hints are free-form text — pack into the action field so all regexes apply.
    ...({ action: [shot.intent, shot.hints].filter(Boolean).join(" ") } as Partial<Breakdown>),
  } as Breakdown;
}

/**
 * Choose the best model for a single shot. Pure.
 */
export function routeShot(
  shot: PlannedShot,
  budget: RoutingBudget = "balanced",
  taste: TasteSignals = {},
): RouteDecision {
  // Honor explicit user override.
  if (shot.locked.model_user_override && shot.locked.model && CATALOG_BY_ID[shot.locked.model]) {
    const m = CATALOG_BY_ID[shot.locked.model];
    return {
      modelId: m.id,
      model: m,
      source: "override",
      reasons: ["User-selected model"],
      alternatives: [],
    };
  }

  const breakdown = shotToBreakdown(shot);
  const ranked = rankModels(breakdown);
  const adjusted = applyBudgetAndTaste(ranked, budget, taste);

  adjusted.sort(
    (a, b) => b.score - a.score || a.model.label.localeCompare(b.model.label),
  );

  const top = adjusted[0]?.model;
  if (!top) {
    // Defensive fallback — should never happen with non-empty catalog.
    throw new Error("routeShot: empty model catalog");
  }

  return {
    modelId: top.id,
    model: top,
    source: "ranking",
    reasons: adjusted[0].reasons,
    alternatives: adjusted.slice(1, 4).map((r) => r.model),
  };
}

function applyBudgetAndTaste(
  ranked: RankedModel[],
  budget: RoutingBudget,
  taste: TasteSignals,
): RankedModel[] {
  const preferred = new Set(taste.preferredModelIds || []);
  const avoid = new Set(taste.avoidModelIds || []);
  const costW = BUDGET_COST_WEIGHT[budget];
  const speedW = BUDGET_SPEED_WEIGHT[budget];

  return ranked.map((r) => {
    let score = r.score;
    const reasons = [...r.reasons];

    const costBump = costW[r.model.cost];
    if (costBump !== 0) {
      score += costBump;
      if (budget !== "balanced") {
        reasons.push(
          budget === "quality" && costBump > 0
            ? "Quality tier (budget)"
            : budget === "cheap" && costBump > 0
              ? "Cheap tier (budget)"
              : `Off-budget (${budget})`,
        );
      }
    }
    const speedBump = speedW[r.model.speed];
    if (speedBump !== 0) score += speedBump;

    if (preferred.has(r.model.id)) {
      score += 1.5;
      reasons.push("Previously liked");
    }
    if (avoid.has(r.model.id)) {
      score -= 2;
      reasons.push("Previously avoided");
    }

    return { ...r, score, reasons };
  });
}
