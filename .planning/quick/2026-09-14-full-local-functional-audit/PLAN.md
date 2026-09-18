# Full local functional audit

## User story

A visitor creates an account through Better Auth, receives a MongoDB-backed session, resumes the guided campaign creator, and can navigate every enabled public and authenticated MovPrompt screen without functional errors, stuck loading states, overflow, or broken alignment.

## Automated cases first

- Sign-up remains disabled until terms are accepted.
- Successful sign-up sends the Better Auth contract and returns to the requested creator route.
- Sign-up errors render an alert and restore an enabled submit action.
- Sign-in errors render an alert and restore an enabled submit action.
- Existing auth timeout, auth API contract, creator progress, guest draft, creator golden-path, API, MongoDB, and package tests all pass.
- Production build and TypeScript checks pass.

## Manual screen audit after automated checks

1. Sign up from `/auth?next=/create`, verify the user/session in MongoDB, then sign out and sign in again.
2. Guided creator: Source, Template, Facts, Campaign, Create/review boundary, responsive progress, and Advanced handoff.
3. Templates list and template detail.
4. Projects list and project resume behavior.
5. Advanced Mode and authenticated history/templates routes.
6. Account settings, billing, preferences, notifications, and referrals.
7. Public pages: home, pricing, learn, about, terms, privacy, reset password, and not-found.
8. Check console errors, failed API requests, loading completion, English/Arabic RTL, and representative 375/768/1024/1440 layouts.

## Boundaries

- Keep all changes local and uncommitted.
- Do not push, deploy, publish, or trigger paid generation.
- Generation remains at the safe pre-generation boundary while `FEATURE_GENERATION=false`.
