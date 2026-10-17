# Simpler Product With Model Ad form

Completed locally, using the approved scoped GSD fallback.

- Removed the saved-brand-kit dropdown and unnecessary list request. Existing snapshots, saved kit IDs/revisions and backend library remain intact.
- Removed the separate category question. Explicit wear-clothing/wear-accessory actions set the required internal category; present/hold retain saved categories.
- Product details, additional brand details and ad messages use native keyboard-accessible disclosures. Brand name, logo/colors and essential direction/duration controls remain visible. No other template forms changed.
- UI/UX skill quick-reference guidance informed progressive disclosure; two focused dataset searches were off-topic, so their returned recommendations were not used.
- Reference: https://higgsfield.ai/blog/higgsfield-ads-studio and https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-marketing-studio-to-create-video-ads . Used their product-first/manual-brand flow as inspiration, not an exact visual clone. Agent Reach Jina reading was blocked; official web search fallback supplied the reference.

Verification:

- 26 focused tests passed, including all 14 existing-form markup comparisons, valid wear action mappings, saved-data preservation and no kit-list request.
- Web typecheck, lint and production build passed. Existing lint and chunk-size warnings remain. git diff --check passed.
- Rendered 375, 768, 1024 and 1440 widths in English/Arabic and light/dark: no horizontal overflow in all 16 combinations.
- Browser verified an edited tagline survived disclosure closing and another setting change; 15-second portrait/silent local prompt validation passed (6177 characters, zero paid calls).
- Screenshot: output/product-model-ad/simplified/form.png . Local review: http://127.0.0.1:8188/product-model-ad-test.html .

No live database mutation, paid generation, commit, push or deployment.
