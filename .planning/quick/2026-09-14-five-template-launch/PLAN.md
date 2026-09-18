# Five-template launch catalog

## Goal

Reduce the launch catalog to five distinct business categories and ensure every template requires the client's uploaded image as the primary generation reference while preserving that image's exact identity.

## Work

1. Replace the development catalog with the five approved launch templates.
2. Add explicit reference-image fidelity instructions to each template recipe and compiled generation prompt.
3. Update catalog, UI, database seed, and worker preflight tests for the five-template launch contract.
4. Prune obsolete template catalog records when reseeding the local development database.
5. Run focused and full automated checks, reseed MongoDB, and verify the five templates through the local API and browser.

## Boundaries

- Keep all changes local and uncommitted.
- Do not push, deploy, publish, or trigger paid video generation.
