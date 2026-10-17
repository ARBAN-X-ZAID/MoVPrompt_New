# Adstudio message-field UI follow-up

Continue the existing GSD quick workflow. `/gsd-quick` and local command/runtime remain unavailable after discovery, so use the same recorded planning fallback.

User request: make the offer and closing-message controls match the rest of Adstudio. Preserve the current brand, layout, optional status, exact values and generation policy.

Design read: a targeted consistency fix for Kuwait business owners using the existing Adstudio form system. Reuse its 12px field radii, 48px input sizing, 16px text, muted surfaces, optional label badges, help/count rows and gold keyboard focus. No new design system or motion.

Audit: offer textarea already matches the shared textarea selector but lacks the usual label/help/count structure. Closing input omits `type="text"`, so the shared `.ad-studio input[type=text]` rules do not apply. Keep element IDs, handlers and max lengths unchanged.

Plan: update only these two field blocks, inspect locally in English/Arabic and light/dark at desktop/mobile, build/typecheck, then publish the website follow-up to the existing Render release. No paid generation or additional tests are requested.

Implementation: both controls now use the existing optional badge, help and character-count layout. Closing input explicitly uses type text, applying the shared styling. Offer textarea uses the same three-row size as comparable multiline controls. Added example placeholders and connected accessible descriptions. Values, limits, callbacks, IDs and optional status remain unchanged.

Local checks: web typecheck, production build, file ESLint and diff whitespace checks pass. DOM styles match Description/Socials controls exactly (12px radius, 12px/14px padding, 16px text, same background, 48px input and 72px textarea minimum height). Visually inspected desktop English light and narrow Arabic light/dark; fields stay within the 375px viewport. Evidence is under `/Users/Projects/VirtuProse/MoVPrompt_New/output/adstudio-message-ui-2026-10-17/`.
