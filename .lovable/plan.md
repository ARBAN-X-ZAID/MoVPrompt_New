The root `/` page (`CinematicHero.tsx`) still speaks to the old "AI Director" positioning. Update every piece of hero text so a new visitor immediately understands the new product: Ads is the main tool and MovPrompt is the ad-template workshop.

## What to change

### 1. `src/components/hero/CinematicHero.tsx`
Replace the old director-centric copy with Ads/template language.

- **Eyebrow badge**
  - From: `AI video director`
  - To: `AI video ad templates`

- **Headline**
  - From: `The director's platform to shoot your best work`
  - To: `The AI ad studio for generative video`
  (Keep the two-line animated structure so the word animation still works.)

- **Subheadline**
  - From: `Every AI video model. Intelligent storyboards. Frame-perfect prompts. On-brand cinematography at any scale.`
  - To: `Describe a concept or upload a reference video. MovPrompt builds structured ad templates — shots, pacing, look — and generates a preview ready for any AI video model.`

- **Primary CTA**
  - From: `Start creating` → `/ads`
  - To: `Create an ad` → `/ads`

- **Secondary CTA**
  - From: `Why MovPrompt?` → `/docs`
  - To: `Build a template` → `/movprompt`

- **Rotating word column** (`src/components/hero/RotatingWordColumn.tsx`)
  - Refresh the word list to match the new positioning:
    `Build ad templates`, `Generate video concepts`, `Shoot campaigns`, `Stay on brand`, `Lock the look`, `Scale ads`, `Storyboard shots`, `Match any model`, `Export to Ads`

### 2. `index.html`
Update the default title and meta description so search/social previews match the new positioning.

- **Title**
  - From: `MovPrompt — AI Director of Photography`
  - To: `MovPrompt — AI Ad Studio for Generative Video`

- **Meta description / og / twitter**
  - From: `Turn any still image into a director-grade cinematic video prompt with AI.`
  - To: `Turn any concept or reference video into a structured ad template and preview. Built for Kling, Veo, Seedance, and every AI video model.`

### 3. `src/components/hero/TrustLogos.tsx` (optional micro-copy)
- Update the label from `Trusted by creators — studios, agencies & enterprises` to `Trusted by creators, studios & brands` so it reads more ad-world than film-world.

## Out of scope
- No routing changes.
- No visual layout changes beyond text and the rotating word list.
- `Landing.tsx` is not currently routed from `/`, so leave it unless you want it updated too.

## Verification
- Typecheck the project after edits.
- Open the preview at `/` and confirm the new headline, badge, subhead, and CTAs render correctly on desktop and mobile.