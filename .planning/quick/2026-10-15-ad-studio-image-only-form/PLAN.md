# Ad Studio image-only form

Use the scoped GSD fallback because slash-command execution is unavailable.

Scope: simplify only the website's Product With Model Ad form. Match the small Higgsfield-style product input while accepting one uploaded product image instead of a product URL. Remove the product-name, extra photos, model selection, brand kit, creative direction, messaging, language, and duration controls from this form. Keep the existing template defaults, preview, pricing, capability checks, and generation action. Use a generic internal product label only where the existing generation contract requires one. Do not change proposal files, other creation forms, API behavior, or deployment state. Keep user-facing copy in the touched form free of semicolons.

Verification: inspect the scoped diff. Do not run automated tests or deploy.
