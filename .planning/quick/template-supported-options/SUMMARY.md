# Completed locally

- Added regression tests before changing the controls; observed the purpose-filter and restored-draft failures.
- Campaign purpose, language and aspect-ratio choices follow the selected template's published API metadata. Quality choices follow the shared server resolution contract (720p and 480p for all current recipes).
- Image uploads and manual source entry no longer overwrite the selected purpose/CTA with service/product defaults.
- Existing incompatible drafts keep their facts and images and require an explicit supported choice. Estimates and submission are blocked before server validation. Catalog errors fail closed with a retry; delayed responses cannot overwrite another template's settings.
- Full web suite: 266 tests passed across 69 files. TypeScript, ESLint and production build passed (existing bundle-size warning).
- Browser: uploaded a disposable local test image to App/Service and confirmed its purpose stayed Demonstration; entered a sample booking link and confirmed it stayed editable. Checked English/Arabic and light/dark at 375, 768, 1024 and 1440px with no horizontal overflow.
- Opened the user's existing saved account project through its canonical project URL; confirmed its image and booking link remained and unsupported Bookings is excluded from the selector. Did not change its purpose or generate a video.
- No provider calls, purchases, credential changes, commits, pushes, deployments or storage deletions.
