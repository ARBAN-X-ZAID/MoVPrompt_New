# Project Memory

## Core
MovPrompt — AI Director of Photography for generative video prompts.
Dark cinematic theme only, never light. bg `240 10% 4%`, primary amber `38 91% 55%`,
brand cyan `190 100% 50%` reserved for active tab pill / one highlighted word in a headline (never borders, info boxes, decorative icons).
Inter Tight + Space Grotesk for display/headings (Space Grotesk leads on Landing), Inter for body. Wordmark itself is a PNG asset (`/logo-wordmark.png` two-tone amber/white, `/logo-wordmark-white.png` mono white for emails+OG) — not Inter Tight, do not try to recreate as inline SVG text.
Wedge mark: asymmetric triangle, top-right edge horizontal at half-width, sharp point at lower-left. Amber (`#E89B3C` / `hsl(var(--accent))`) for app/favicon/PWA; white variant inside dark UI that already glows (Director hero, AssistantAvatar).
Lovable Cloud backend with Lovable AI (gemini-3.1-pro-preview for Director vision + reasoning).
Always help the user reach their goal — when the Director asks open-ended questions, provide examples, chips, or upload affordances so the user is never stuck on a blank input.
User-facing product name is always "MovPrompt" — do not reintroduce stale names (MovPrompt, Apertural).

## Memories
- [Design tokens](mem://design/tokens) — Full dark cinematic palette, fonts, glow animations
- [App architecture](mem://features/architecture) — Three workflows: single frame, two frames, multi-shot storyboard
