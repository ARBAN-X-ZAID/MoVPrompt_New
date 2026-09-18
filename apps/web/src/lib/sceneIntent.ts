// Detects whether an @N mention in a description implies Move or Lock
// based on nearby English (and Arabic connector) verbs. Supports chain
// inheritance ("lock @1 and @2 and @3") and reverse patterns ("@1, @2 are locked").

export const MOVE_VERBS = [
  "move", "moves", "moving", "moved",
  "walk", "walks", "walking", "walked",
  "run", "runs", "running", "ran",
  "fly", "flies", "flying", "flew", "flown",
  "rotate", "rotates", "rotating", "rotated",
  "shift", "shifts", "shifting", "shifted",
  "travel", "travels", "traveling", "travelled", "traveled",
  "sweep", "sweeps", "sweeping", "swept",
  "drift", "drifts", "drifting", "drifted",
  "pan", "pans", "panning", "panned",
  "zoom", "zooms", "zooming", "zoomed",
  "animate", "animates", "animating", "animated",
  "morph", "morphs", "morphing", "morphed",
  "transform", "transforms", "transforming", "transformed",
  "turn", "turns", "turning", "turned",
  "slide", "slides", "sliding", "slid",
  "dance", "dances", "dancing", "danced",
  "jump", "jumps", "jumping", "jumped",
  "drive", "drives", "driving", "drove",
  "glide", "glides", "gliding", "glided",
  "sway", "sways", "swaying", "swayed",
  "spin", "spins", "spinning", "spun",
];

export const LOCK_VERBS = [
  "keep", "keeps", "keeping", "kept",
  "lock", "locks", "locking", "locked",
  "freeze", "freezes", "freezing", "frozen", "froze",
  "hold", "holds", "holding", "held",
  "stay", "stays", "staying", "stayed",
  "fix", "fixes", "fixing", "fixed",
  "preserve", "preserves", "preserving", "preserved",
  "maintain", "maintains", "maintaining", "maintained",
  "unchanged",
  "still",
  "static",
  "same",
  "remain", "remains", "remaining", "remained",
  "idle",
  "motionless",
  "stationary",
];

const MOVE_SET = new Set(MOVE_VERBS.map((v) => v.toLowerCase()));
const LOCK_SET = new Set(LOCK_VERBS.map((v) => v.toLowerCase()));
const NEGATORS = new Set(["not", "no", "dont", "doesnt", "didnt", "wont", "never", "without"]);
// Connectors that bind mentions into a shared-intent chain.
const CONNECTORS = new Set(["and", "&", "+", "with", "plus", "،", "و"]);

const FORWARD_WINDOW = 12; // tokens after a verb that it can "own"
const REVERSE_WINDOW = 6;  // tokens after a chain that a trailing verb can apply

type Intent = "move" | "lock";

interface Token {
  raw: string;
  plain: string;       // alpha-only lowercase
  mention: number | null; // N for "@N", else null
  isComma: boolean;
}

function tokenize(text: string): Token[] {
  // Split on whitespace AND keep commas as their own tokens (they act as connectors).
  const parts = text
    .replace(/,/g, " , ")
    .replace(/،/g, " ، ")
    .split(/\s+/)
    .filter(Boolean);
  return parts.map((raw) => {
    const lower = raw.toLowerCase();
    const mentionMatch = lower.match(/^@(\d+)/);
    return {
      raw,
      plain: lower.replace(/[^a-z]+/g, ""),
      mention: mentionMatch ? parseInt(mentionMatch[1], 10) : null,
      isComma: raw === "," || raw === "،",
    };
  });
}

function isNegated(tokens: Token[], verbIdx: number): boolean {
  for (let j = Math.max(0, verbIdx - 2); j < verbIdx; j++) {
    if (NEGATORS.has(tokens[j].plain)) return true;
  }
  return false;
}

function classifyVerb(tokens: Token[], i: number): Intent | null {
  const w = tokens[i].plain;
  if (!w) return null;
  if (LOCK_SET.has(w)) return isNegated(tokens, i) ? "move" : "lock";
  if (MOVE_SET.has(w)) return isNegated(tokens, i) ? "lock" : "move";
  return null;
}

function isConnector(t: Token): boolean {
  return t.isComma || CONNECTORS.has(t.plain) || CONNECTORS.has(t.raw.toLowerCase());
}

/**
 * Detect intent for every @N mention in one pass.
 * - Forward: a verb owns the next mention within FORWARD_WINDOW tokens.
 *   Subsequent mentions joined by connectors (and/&/,/+/with/plus/و/،) inherit.
 * - Reverse: a chain of mentions followed within REVERSE_WINDOW tokens by a verb
 *   (with no other verb between) applies that verb to all chain members.
 * Later assignments win (so explicit per-mention verbs override earlier inheritance).
 */
export function detectAllIntents(text: string, _maxIndex?: number): Record<number, Intent> {
  const result: Record<number, Intent> = {};
  if (!text) return result;
  const tokens = tokenize(text);
  const n = tokens.length;

  // Pass 1: forward propagation from verbs.
  for (let i = 0; i < n; i++) {
    const intent = classifyVerb(tokens, i);
    if (!intent) continue;
    // Find first mention within FORWARD_WINDOW after this verb, stopping if another verb appears.
    let firstMentionIdx = -1;
    for (let j = i + 1; j < Math.min(n, i + 1 + FORWARD_WINDOW); j++) {
      if (j !== i && classifyVerb(tokens, j)) break;
      if (tokens[j].mention !== null) { firstMentionIdx = j; break; }
    }
    if (firstMentionIdx === -1) continue;
    result[tokens[firstMentionIdx].mention!] = intent;
    // Continue chain: connector → mention, repeat until break.
    let k = firstMentionIdx + 1;
    while (k < n) {
      // Skip connectors
      let sawConnector = false;
      while (k < n && isConnector(tokens[k])) { sawConnector = true; k++; }
      if (!sawConnector) break;
      if (k >= n) break;
      // Next token must be a mention with no intervening verb
      if (classifyVerb(tokens, k)) break;
      if (tokens[k].mention === null) break;
      result[tokens[k].mention!] = intent;
      k++;
    }
  }

  // Pass 2: reverse pattern. For each mention, look ahead for a chain followed by a verb.
  for (let i = 0; i < n; i++) {
    if (tokens[i].mention === null) continue;
    // Build chain starting at i: mention (connector mention)*
    const chain: number[] = [tokens[i].mention!];
    let j = i + 1;
    while (j < n) {
      let sawConnector = false;
      while (j < n && isConnector(tokens[j])) { sawConnector = true; j++; }
      if (!sawConnector) break;
      if (j >= n || tokens[j].mention === null) break;
      chain.push(tokens[j].mention!);
      j++;
    }
    if (chain.length < 2) continue; // single mention handled by pass 1
    // Look ahead up to REVERSE_WINDOW tokens for a verb, with no other verb between.
    let trailingIntent: Intent | null = null;
    for (let k = j; k < Math.min(n, j + REVERSE_WINDOW); k++) {
      const v = classifyVerb(tokens, k);
      if (v) { trailingIntent = v; break; }
    }
    if (!trailingIntent) continue;
    for (const m of chain) {
      // Reverse pattern only fills in mentions that pass 1 didn't already explicitly set.
      if (result[m] === undefined) result[m] = trailingIntent;
    }
  }

  return result;
}

/**
 * Back-compat: detect intent for a single @N. Uses the full-pass map.
 */
export function detectIntent(text: string, mentionNumber: number): Intent | null {
  const all = detectAllIntents(text);
  return all[mentionNumber] ?? null;
}
