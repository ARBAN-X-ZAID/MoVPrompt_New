# Owner sign-in and loading redesign

Use the previously approved manual GSD workflow. Scope is the owner sign-in screen shown in the screenshot and its loading states, preserving simplified admin navigation and all authentication/owner/MFA rules.

## Audit and design read

Redesign-preserve. Existing brand uses an orange accent, Inter/Inter Tight and Noto Sans Arabic, Radix/shadcn form controls, Lucide icons and 12px radii. The current sign-in floats in excess whitespace, has low-contrast white text on orange, and exposes deployment terminology. The initial admin identity check renders an inline loader at the top left. The lazy route loader is already centered but visually unrelated.

DESIGN_VARIANCE: 3. MOTION_INTENSITY: 2. VISUAL_DENSITY: 4. Retain the existing design system, typography and accent. Use a centered, bounded panel on a gently tinted surface with visible labels, accessible focus/contrast, optional password visibility and bilingual theme controls. No decorative images or marketing hero are appropriate for this authentication surface. Apply the invoked design-taste skill's relevant redesign guidance; its marketing-only and dashboard exclusions are respected.

## Work and verification

- Share a responsive access frame between sign-in and initial loading. Make both admin lazy loading and identity loading use this centered skeleton.
- Keep compact MFA dialogs compact. Preserve credential submission, TOTP, recovery and enrollment behavior.
- Center section loaders, add useful accessible loading text and respect reduced motion.
- Verify sign-in, denied access, pending/error, password visibility, MFA/backup routing and loading layouts with focused tests and rendered local browser checks.
- Inspect 375, 768, 1024 and 1440 pixels, English/Arabic, light/dark. Run forced typecheck, web regression and production build. Run the invoked skill's Lighthouse audit through a temporary CLI, without adding an application dependency. Distinguish dev-server timing from production performance.
