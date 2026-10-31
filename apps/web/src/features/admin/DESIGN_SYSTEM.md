# Owner admin design system

The admin has one source of look and behaviour. New screens reuse these parts instead of adding page-level styles.

## Tokens (`admin.css`)

| Group | Tokens | Rule |
|---|---|---|
| Surfaces | `--a-bg`, `--a-surface`, `--a-surface-2`, `--a-hover` | Page, card, table header, hover |
| Lines | `--a-line`, `--a-line-strong` | Borders only |
| Text | `--a-text`, `--a-text-2`, `--a-text-3` | Primary, secondary, hint |
| Accent | `--a-accent`, `--a-accent-text`, `--a-accent-soft` | Primary action and active nav only |
| Status | `--a-success`, `--a-warning`, `--a-danger`, `--a-info` and `-soft` | Status badges and alerts only |
| Type | 12, 13, 14, 16, 20, 24px | 13px in tables, 24px page titles |
| Radius | 6, 8, 12px | Small control, control, card |
| Control height | `--a-control` | 36px, 44px on phones |

Light and dark are defined together. shadcn variables are remapped inside `.admin-workspace`, so `Button`, `Input` and `Dialog` content inherit the same surfaces.

## Components

| Component | File | Use |
|---|---|---|
| `AdminTable`, `AdminPagination` | `AdminTable.tsx` | Every list, built on TanStack Table |
| `AdminPageHeader`, `AdminBack` | `AdminChrome.tsx` | Every page title; every detail page passes `back` |
| `AdminCard`, `AdminFacts` | `AdminChrome.tsx` | Grouped content and label/value pairs |
| `StatusBadge` | `AdminChrome.tsx` | Every status; add new values to `TONES` |
| `AdminEmpty` | `AdminChrome.tsx` | Empty states |

## Patterns

- **Lists:** pass `rowHref` and `rowLabel` so the whole row opens. Links and buttons inside a row keep their own action.
- **Back:** build links with `withReturnTo(path, location)`. `AdminBack` restores the list, filters and page, and only accepts `/admin` paths.
- **Data:** debounce search by 300ms, use `placeholderData: keepPreviousData` on lists, and refresh with `invalidateAdminData(client)`.
- **Media:** never mount a `<video>` per row. Load it when the owner opens it.
- **Text:** business language only. No ids, hashes, prompts or raw JSON.
- **Mixed language:** use `dir="auto"` on customer text. `.admin-cell-title` keeps it aligned with its column.
