# Development-free generation summary

Implemented a local-only development mode that hides payment, price, credit, token, wallet, and billing surfaces while preserving an internal zero-value quote for version binding and idempotency. The API ignores this bypass outside `APP_ENV=local`.

Removed the product price from creator setup, fact review, final review, summary, and generated template prompts. Corrected the campaign form grid alignment by top-aligning grid children. Configured local Vercel Gateway generation, the fast Seedance development model, FFmpeg/FFprobe, provider host validation, and private local MinIO storage.

Production commercial behavior is documented in `PAYMENTS.md`. No repository commit, push, deployment, or paid generation was performed.
