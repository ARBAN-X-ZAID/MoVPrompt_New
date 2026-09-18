---
phase: 2
slug: guest-authentication-and-data-integrity
status: approved
shadcn_initialized: true
preset: default / radix / slate / CSS variables
created: 2026-08-19
---

# Phase 2 — UI Design Contract

> Approved visual and interaction contract for guest-draft recovery, Generate-time authentication, private asset claiming, and safe authentication returns.

---

## UX and Screen Contract

**Primary user:** Kuwait business owner who has configured a campaign but does not need to understand accounts, cloud storage, or asset claiming.

**User goal:** Select Generate once, authenticate only then, and continue with the exact campaign and media they configured.

**Business goal:** Reduce Generate-time abandonment while making ownership, privacy, and duplicate-prevention understandable without exposing implementation details.

**Top tasks:**

1. Start authentication from the final Create review without losing a single campaign field or local image.
2. Create/sign in with email and password, or use a configured social provider, then return to the same pending generation intent exactly once.
3. Recover safely from cancellation, lost connectivity, expired drafts, claim failure, a wrong account, or a replayed callback.

**Information architecture and one job per screen:**

| Surface | One job | Must not add |
|---|---|---|
| Create review | Confirm the campaign, then select **Generate video** | Account prompts before Generate, account dashboard, provider/model language |
| Generate-time auth dialog | Explain preservation and choose an authentication method | Campaign editor or onboarding steps |
| `/auth` | Sign in, create an account, or request a password reset, then return safely | A second campaign review or generic dashboard |
| `/auth/callback` | Restore the safe return intent and resume/recover the existing campaign | A new project, success toast, or marketing content |
| Claim-progress view/state | Explain that MovPrompt is securing the existing campaign | Render/video progress, percentage animation, provider details |
| Workspace reminder | Prompt later email verification without blocking the first campaign | Mandatory verification gate |

**Flow contract:** preserve `pendingGenerationId` and idempotency key before opening auth; resume priority is stable pending intent, then validated same-origin `next`, then `/create`. Claim success is only complete after the returned project/version configuration and every private asset checksum are verified. Local JSON and blobs remain until then. A failed, cancelled, expired, or mismatched path never silently changes template, sources, facts, language, market, CTA, destinations, price, offer, presenter, ratio, resolution, audio, subtitles, rights decision, or Advanced references.

---

## Design System

| Property | Value |
|---|---|
| Tool | shadcn/ui, already initialized in `apps/web/components.json` |
| Preset | `default` style, Radix base, Slate base color, Tailwind CSS variables; detected with `npx shadcn info` on 2026-08-19 |
| Component library | Existing shadcn/Radix primitives: `Dialog`, `Button`, `Input`, `Label`, `Tabs`, `Checkbox`, `Alert`, `Toast`/`Sonner`, `Spinner` |
| Icon library | Existing Lucide React; icons are supplemental to an accessible text label |
| Fonts | Inter body/UI; Inter Tight headings; Noto Sans Arabic fallback for Arabic UI |
| Direction and theme | Reuse the existing document `lang`/`dir` switch (`en`/LTR, `ar`/RTL) and semantic light/dark tokens. Use logical CSS properties (`padding-inline`, `margin-inline`, `inset-inline`) for all Phase 2 additions. |

**Visual thesis:** keep the calm, editorial creator workspace intact. Authentication is a short, reassuring interruption: the existing warm-white/near-black surfaces, fine borders, generous whitespace, and amber action signal that the campaign is still in the user's control. The dialog's focal point is the preservation promise and primary authentication action; the lock mark supports that message without competing with it. It must not become a dashboard, a feature-card grid, or a new visual language.

**Component rules:**

| Component | Use and behavior |
|---|---|
| `AuthGateDialog` | Reuse the existing `creator-auth-gate` composition: 48px lock mark, title, preservation explanation, method actions, and final price note. It is the only auth surface launched from Create. |
| Auth form | Reuse current one-column form card and `Tabs`; email/password is first and primary. Render Google or Apple buttons only when that provider is configured. Do not leave a blank divider or disabled provider button. |
| Claim progress | Reuse Creator shell/panel surfaces, one centered status block, one factual current stage, and an accessible status region. No progress percentage or fake render preview. |
| Error notice | Reuse semantic destructive border/background/text and place it beside the failed field or claim action. Include exactly one recovery action; retain all entered values. |
| Verification reminder | Reuse the existing quiet `role="note"`/muted surface after the account is available; do not use destructive/error treatment or block Generate. |

No new reusable tokens, component families, registries, cards, dashboards, or icon-only actions are introduced in this phase.

---

## Spacing Scale

Declared values (all Phase 2 additions use multiples of four; preserve adjacent existing creator measurements where changing them would create visual drift):

| Token | Value | Usage |
|---|---:|---|
| xs | 4px | Icon-to-label offset; inline error indicator gap |
| sm | 8px | Field-label and stacked-action gaps |
| md | 16px | Form/control groups; notice padding |
| lg | 24px | Dialog/form card internal sections; screen gutters at tablet |
| xl | 32px | Major auth/claim content separation |
| 2xl | 48px | Claim-status breathing room; desktop section separation |
| 3xl | 64px | Desktop page-level separation only |

**Exceptions:** interactive controls are never smaller than 44 by 44px; the existing creator primary button remains 46px and inputs remain 48px. At 375px, all dialog/page side gutters are 16px and stacked action gaps remain 8px.

---

## Typography

Phase 2 uses these four roles only; use `400` and `700` only. The existing Inter Tight treatment and tracking remain for headings, including Arabic fallback behavior.

| Role | Size | Weight | Line height | Use |
|---|---:|---:|---:|---|
| Label/caption | 12px | 700 | 1.2 | Field labels, helper text, preservation note, status metadata |
| Body | 14px | 400 | 1.5 | Inputs, form copy, errors, actions, toast descriptions |
| Lead | 16px | 400 | 1.55 | Auth/claim explanation and recovery guidance |
| Heading | 25px | 700 | 1.2 | Auth dialog and claim state heading; use current Inter Tight heading styling |

Long Arabic and English copy wraps naturally; do not truncate a title, error, preservation promise, CTA, or account-safety message. Error/support codes may wrap at any character with `overflow-wrap:anywhere` and are never the sole explanation.

---

## Color

Use semantic tokens, never hard-coded phase-specific colors. The numerical values below document the existing creator palette, not a new palette.

| Role | Existing value | Usage |
|---|---|---|
| Dominant (60%) | Light: `--creator-canvas` `40 18% 97%`; dark: `240 8% 5%` | Page canvas and claim background |
| Secondary (30%) | Light: `--creator-panel` `0 0% 100%`, `--creator-soft` `35 12% 93%`; dark: `240 7% 8%`, `240 6% 12%` | Existing auth dialog/form card, quiet note, secondary controls, dividers |
| Accent (10%) | Light: `--creator-action` `37 88% 48%`; dark: `38 91% 55%` | Primary **Continue with email**, configured first social action, **Generate video**, selected tab/control, focus ring, active claim indicator only |
| Success | `--creator-success` | Completed claim status and later-verification reminder icon only |
| Destructive | `--creator-danger` / semantic `--destructive` | Field errors, failed claim/import, expired/cannot-recover states only |

Accent is reserved for: Generate video; the first available auth method; the selected auth tab; explicit **Retry securing image** after a claim failure; active/focused form controls; and one current claim-state indicator. It is not used for passive icons, all links, background decoration, or provider branding.

---

## Copywriting Contract

All messages are product-language, never internal terms such as IndexedDB, checksum, object key, callback, provider, or storage namespace. Render the matching UI language as the complete string below; do not concatenate translated fragments. English product/source names, email addresses, codes, URLs, and KWD values remain LTR-isolated in Arabic UI.

| Element/state | English (exact) | Arabic (exact) |
|---|---|---|
| Primary CTA on campaign review | **Generate video** | **ولّد الفيديو** |
| Auth-gate title | **Your campaign is ready to create** | **حملتك جاهزة للإنشاء** |
| Auth-gate description | **Create an account to start the render. Your product, template, and campaign settings will return exactly as you left them in this browser.** | **أنشئ حساباً لبدء التوليد. سيعود منتجك والقالب وإعدادات حملتك كما تركتها تماماً في هذا المتصفح.** |
| Auth-gate note | **No charge is made until the final price is confirmed. Cancel to keep editing.** | **لن يتم الخصم قبل تأكيد السعر النهائي. أغلق النافذة لمتابعة التعديل.** |
| Email action | **Continue with email** | **المتابعة بالبريد الإلكتروني** |
| Email sign-in action | **Sign in** | **تسجيل الدخول** |
| Create-account action | **Create account** | **إنشاء حساب** |
| Password reset sent | **If an account exists, we sent a secure reset link.** | **إذا كان الحساب موجوداً، أرسلنا رابطاً آمناً لإعادة التعيين.** |
| Draft saved default | **Your campaign is saved in this browser.** | **حملتك محفوظة في هذا المتصفح.** |
| Cancel auth success | **Nothing changed. Continue editing when you’re ready.** | **لم يتغيّر شيء. تابع التعديل عندما تكون جاهزاً.** |
| Auth/callback loading | **Restoring your campaign** / **Keep this page open for a moment.** | **جارٍ استعادة حملتك** / **أبقِ هذه الصفحة مفتوحة للحظة.** |
| Claim loading heading | **Securing your campaign…** | **جارٍ تأمين حملتك…** |
| Claim loading detail | **Saving your campaign and images privately. Keep this page open.** | **جارٍ حفظ حملتك وصورك بشكل خاص. أبقِ هذه الصفحة مفتوحة.** |
| Claim success | **Your campaign is secured. Checking the saved details now.** | **تم تأمين حملتك. جارٍ التحقق من التفاصيل المحفوظة الآن.** |
| Claim failure | **We couldn’t secure this image. Your campaign is still saved here.** | **لم نتمكن من تأمين هذه الصورة. حملتك ما زالت محفوظة هنا.** |
| Claim failure actions | **Retry securing image** / **Replace image** | **أعد تأمين الصورة** / **استبدل الصورة** |
| Offline | **You’re offline. Your campaign is still saved in this browser. Reconnect, then try again.** | **أنت غير متصل بالإنترنت. حملتك ما زالت محفوظة في هذا المتصفح. اتصل بالإنترنت ثم حاول مرة أخرى.** |
| Session mismatch | **This campaign belongs to a different signed-in account. We kept it private and did not change it.** | **هذه الحملة تخص حساباً مسجلاً آخر. أبقيناها خاصة ولم نغيّرها.** |
| Session-mismatch actions | **Continue editing** / **Sign out and use another account** | **تابع التعديل** / **سجّل الخروج واستخدم حساباً آخر** |
| Expired draft | **This browser draft expired after 7 days. Start a new campaign.** | **انتهت صلاحية مسودة هذا المتصفح بعد ٧ أيام. ابدأ حملة جديدة.** |
| Expired action | **Start a new campaign** | **ابدأ حملة جديدة** |
| Callback replay | **Your campaign is already secured. Opening it now.** | **حملتك مؤمّنة بالفعل. جارٍ فتحها الآن.** |
| Non-blocking verification reminder | **Verify your email to protect your account. You can do this later in Account settings.** | **أكّد بريدك الإلكتروني لحماية حسابك. يمكنك القيام بذلك لاحقاً من إعدادات الحساب.** |
| Source/import failure | **We couldn’t import that source. Your campaign is unchanged. Try again or upload images instead.** | **لم نتمكن من استيراد هذا المصدر. حملتك لم تتغيّر. حاول مرة أخرى أو ارفع صوراً بدلاً من ذلك.** |

**Validation copy:** preserve the current labelled inputs and show field-level text under the affected field. Required rights confirmation: **Confirm that you have permission to use these images and that the campaign facts are accurate.** / **أكّد أن لديك إذناً لاستخدام هذه الصور وأن معلومات الحملة دقيقة.** A bad sign-in, sign-up, or reset response states what happened and a next action, then appends the draft-saved sentence when a draft is pending. Never reveal whether an account email exists beyond the neutral reset copy.

**Destructive actions:** none. Closing/cancelling auth, cancelling claim progress, retrying, replacing an image, signing out, and starting a new campaign must not delete the retained local draft automatically. Local guest blobs are deleted only after verified successful claim; that background cleanup has no user confirmation dialog because it is post-verification data transfer, not an optional destructive user action.

---

## Interaction and State Contract

### Authentication and return behavior

| State | UI and behavior | Primary action |
|---|---|---|
| Default, guest at Generate | Validate campaign and persist the stable pending intent before opening `AuthGateDialog`. Do not navigate away. The dialog repeats the local-preservation promise. | First configured social provider, otherwise **Continue with email** |
| Default, authenticated at Generate | Skip auth. Move directly to truthful claim progress; preserve existing `pendingGenerationId`. | None until verified quote confirmation/resume |
| Auth form loading | Disable only duplicate-submit paths, retain field values, use spinner plus button text; keep the form readable and do not replace it with an empty page. | Current submit action is busy |
| Auth success | Return via validated same-origin path, restore the draft, and announce the existing campaign. First campaign proceeds without verification. | Continue automatic safe resume only when price/rights still match; otherwise return to review |
| Auth cancellation/close/Escape | Close dialog or return from auth to the unchanged draft; restore focus to **Generate video** and announce the cancellation copy once. Never clear `pendingGenerationId`. | **Generate video** |
| Social provider unavailable | Do not render the provider button or separator. Email/password remains usable. | **Continue with email** |
| Password reset | Preserve the safe return intent only. Reset link and reset completion may return only to a validated same-origin MovPrompt route. | **Send reset link**, then **Sign in** |
| Callback replay/second tab | Reuse the same project/version/pending generation record. Route to it with `replace`; show no second project, charge, duplicate success toast, or new claim animation. The optional replay message is one polite status announcement only. | Open existing project |

### Claim, integrity, and recovery behavior

| State | UI and behavior | Recovery/action |
|---|---|---|
| Claim loading | Use a dedicated Creator-shell status state with actual stages: **Creating your private campaign**, **Securing image N of N**, **Checking saved campaign details**. Announce stage changes politely; do not invent a percent, video preview, provider state, or completion time. | **Cancel and keep editing** stops the client attempt only; retained local draft stays intact. |
| Claim success | Show success copy while checking returned facts/assets against the saved draft. Continue only after all expected configuration and checksums verify; then quote refresh follows existing truth contract. | Continue to the existing review/progress route |
| Asset/import/claim error | Keep the complete local draft, every blob, current auth session, form input, and pending intent. Identify only the affected user-facing image/source, not a bucket/key/remote URL. | **Retry securing image** resumes the failed asset; **Replace image** returns to the existing source control. |
| Offline/network loss | Stop new auth/claim submissions, retain values/blobs, show the offline copy in a persistent inline alert. Browser reconnection may enable retry, but never starts a claim automatically. | **Retry** after reconnection / **Continue editing** |
| Session mismatch | Do not show the other account email, project name, or any owned data. Do not claim the draft, delete it, or navigate to another user's project. | **Continue editing** or explicit **Sign out and use another account** |
| Expired/missing local draft | Show only the expired state; do not show partial campaign fields, local asset names, or an account claim affordance. | **Start a new campaign** |
| Quote changed after restore | Retain recovered project and show current established price-change notice. Automatic resume stops until the user reviews price and selects Generate again. | **Generate video** after review |

### Form, focus, keyboard, and announcement rules

- Use native `form`, `label`, `button`, `input`, and checkbox controls. Placeholder text never substitutes for a label. Error text is linked with `aria-describedby`; invalid inputs receive `aria-invalid="true"`.
- Every control is at least 44 by 44px. Inputs/buttons retain the current 46–48px creator sizing. Icon-only close buttons require an accessible localized name.
- On dialog open, trap focus. Move focus to the first enabled authentication method; when no social provider is configured, this is **Continue with email**. On close/cancel, return focus to the originating **Generate video** button.
- On the `/auth` page, focus the `h1` (`tabindex="-1"`) after direct/callback navigation; after a deliberate email-method click, focus the email field. When submit validation fails, move focus to the first invalid field. On reset, move focus to the form error; on success, focus the safe next-page heading.
- Claim/callback loading uses one `role="status" aria-live="polite" aria-atomic="true"` region. Errors use `role="alert"`; after a claim error focus its **Retry securing image** button. Avoid repeated toasts and duplicate live announcements.
- `Escape`, overlay close, and the explicit close icon all mean cancel only when no non-interruptible claim request is in progress; their result is the unchanged draft. No keyboard trap may remain after close.
- Use visible 3px amber focus treatment and do not rely on color alone for selected/error/success state. Respect `:focus-visible`, not mouse-only focus.

### Motion

Use only existing restrained feedback: 160ms standard transition for control state, and one 160ms opacity plus 4px vertical entrance for dialog/claim content. Do not animate claim percentages, decorative loops, or fake media. Under `prefers-reduced-motion: reduce`, remove transforms and use immediate opacity/state changes; existing creator reduced-motion rule remains authoritative.

---

## Responsive, RTL, and Accessibility Acceptance

Validate the full auth/claim/recovery matrix in English/LTR and Arabic/RTL, light and dark, at each viewport below. This acceptance is required before implementation is accepted.

| Viewport | Required behavior |
|---|---|
| 375px | Auth dialog has 16px minimum viewport gutter, scrolls internally when necessary, and keeps close/action controls visible. `/auth` is a one-column form; benefit panel remains hidden. Actions stack full-width; no horizontal overflow; labels/messages wrap. |
| 768px | Existing two-column auth composition may appear. Each column remains usable, form stays at least 320px wide, and Arabic logical alignment/order is correct. Dialog remains centered, max 440px, with 24px viewport gutter. |
| 1024px | Preserve the existing creator/auth layout and visible benefit context without compressing form fields, notice copy, or 44px targets. Claim status remains centered and does not resemble generation progress. |
| 1440px | Preserve current generous whitespace and max form/dialog widths. Never stretch auth controls to the entire half-screen or introduce a card grid. |

Additional WCAG 2.2 AA acceptance:

- Keyboard-only path completes Generate → auth → callback → restored review, including cancellation, password reset, retry, and session mismatch. Focus order follows visual/logical reading order in LTR and RTL.
- Text, borders, focus ring, success, destructive error, and disabled states meet AA contrast in both themes. State is conveyed with text and icon/shape as well as color.
- Dialog semantics include title/description, focus trap, labelled close control, Escape behavior, and restore focus. Loading and error announcements are concise and non-duplicated.
- Arabic uses actual `dir="rtl"`, logical layout, readable Noto Sans Arabic fallback, correct punctuation/numeral isolation, and no forced left/right alignment. Mixed English account addresses/codes remain direction-isolated.
- All state changes retain the user-entered form data and local media on failure; screen readers receive the recovery action in the same announcement context.

---

## UI Considerations

Applicable state considerations resolved: 12 covered, 4 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / reason |
|---|---|---|---|
| empty | Guest draft restore | ✅ covered | Missing or seven-day-expired draft renders the exact expired-draft copy and only **Start a new campaign**. |
| loading | Auth dialog/form, callback, claim status | ✅ covered | Buttons show a busy state without clearing form data; callback and claim use factual `role=status` copy/stages. |
| error | Auth form, source import, per-asset claim, reset form | ✅ covered | Field/inline error explains the failure and recovery; all draft JSON/blobs/input remain. |
| populated | Restored campaign and claimed assets | ✅ covered | Restored review displays the same selected template/source/facts/settings; progress continues only after configuration/checksum verification. |
| partial | Multi-asset claim | ✅ covered | Show factual `Securing image N of N`; on failure retain all assets and allow retry of the failed asset or replacement. |
| overflow | Auth dialog, form, long preservation/error copy | 🧪 backstop | Visual tests at 375px English/Arabic confirm internal dialog scroll, wrapping, and no horizontal overflow or clipped actions. |
| long-text | Localized labels, account errors, source/image names | 🧪 backstop | Visual tests use long Arabic/English values; labels/messages wrap and sensitive values are not truncated into ambiguity. |
| long-text | Safe account route/support ID | ✅ covered | Route is not displayed; support/request codes wrap with `overflow-wrap:anywhere` and retain a plain-language error. |
| zero-one-many | Configured social providers | ✅ covered | Zero renders email only/no divider; one renders one provider then divider/email; two render configured Google and Apple only. |
| empty | Social provider configuration | ✅ covered | Unconfigured providers have no control, placeholder, or disabled state. |
| error | Callback replay/session mismatch | ✅ covered | Replay reuses existing record and a session mismatch never reveals other-account data; both provide a safe route. |
| loading | Offline/reconnect | 🧪 backstop | E2E toggles offline during auth/claim; new submission stops, draft survives reload, and retry enables after reconnection without auto-claim. |
| populated | Authenticated project ownership confirmation | 🧪 backstop | Browser E2E confirms claimed project opens for owner only and uses a refreshed authorized asset URL after expiry. |
| partial | Quote changed after recovery | ✅ covered | Recovered campaign remains shown; automatic start stops and the existing price-review message requires a renewed Generate action. |
| overflow | Screen navigation/actions | ✅ covered | At narrow sizes, auth actions stack and creator layout uses its existing single-column/mobile behavior; no hidden primary action. |
| empty | Verification reminder | ✅ covered | Unverified account has a quiet non-blocking reminder; verified account renders no empty placeholder. |

---

## Registry Safety

| Registry | Blocks used in Phase 2 | Safety gate |
|---|---|---|
| shadcn official | Existing `dialog`, `button`, `input`, `label`, `tabs`, `checkbox`, `alert`, `toast`, `spinner` only | Not required; existing local components verified by `npx shadcn info` on 2026-08-19 |
| Third-party | None | No registry declared; no vetting required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved
