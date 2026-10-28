# Owner access redesign

The owner sign-in now uses a centered, bounded panel with the existing MovPrompt accent and typography, readable field boundaries, dark text on the orange primary button, password visibility, and bilingual theme controls. Compact owner-confirmation dialogs retain their existing workflow.

Both admin route loading and initial identity loading use the same centered skeleton. Section loading is centered and named for assistive technology. Motion is limited to state feedback and respects reduced motion.

A rejected cached owner session now immediately returns to owner access. Previously, sign-out could leave cached admin content on screen until refresh. Backend owner checks, MFA, recovery, read-only production settings and navigation remain unchanged.

## Verification

- 529 web tests passed, including new coverage of password visibility, pending/error handling, recovery-code routing, owner denial, named skeleton loading and rejection of cached sessions.
- Forced web typecheck, lint (zero errors, 20 existing warnings), production build and bundle budget passed. Initial gzip 260,792 bytes, limit 307,200.
- Real local synthetic password + TOTP login succeeded. Sign-out returned directly to sign-in without reload.
- Browser inspected English/light and Arabic/dark at 375, 768, 1024 and 1440 pixels. Panels remained horizontally centered, no horizontal overflow, and primary action stayed visible at 812px height, including denied-access copy.
- Inspected actual loading and denied-access components using a temporary local review fixture. Fixture removed after review.
- Lighthouse accessibility scored 100 on the local dev sign-in. Dev-server performance scored 48 due to unminified development modules and startup work. This is not a production performance score.

## Skill preflight

Redesign-preserve, dials 3/2/4, existing Radix/shadcn + Lucide, no new application dependency. Existing wordmark, routes, form field names/order and authentication rules preserved. One accent, consistent panel/control radii, no decorative images, marketing hero, em-dash copy or fake product visuals. Marketing-specific image/hero/section rules do not apply to this private authentication surface. Existing global font loading is outside this targeted redesign.
