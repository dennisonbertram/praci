# UX Visual inventory: Contacts (2026-10-20)

## Design system rules (from AGENTS.md)
- Colors are semantic tokens from `@rakazo/ui-tokens`: no hex values and no `[var(--…)]`.
- Components are shadcn on Base UI, vendored in `packages/ui-web`. The app is monochrome: primary is ink, and the status colors are destructive, success and warning.
- Every component has a sibling `*.stories.tsx`. Run `pnpm design-system` after component changes. `pnpm design-system:check` and `node .storybook/smoke.mjs` must pass.
- UI and copy stay minimal: progressive disclosure and no explainer text.

## Pages and states
| Page | Route / story | States |
|------|---------------|--------|
| Contacts | `/app/contacts`; stories `pages-contacts--*` | populated, searched, no-matches (Clear filters), empty, load-error (Try again), deleted-with-undo, added-by-agent, loading (skeleton) |
| Cap table contacts list | `/app/cap-table` (Investors, Auditors, Other, All tabs) | populated with Carta holders, contact rows, delete with Undo |

## Transient UI
| Component | Story | States |
|-----------|-------|--------|
| ContactDialog | `components-contactdialog--*` | new, editing, added-by-agent, duplicate-email, from-cap-table (Carta hint), prefilled-from-holder |
| ContactNotice | `components-contactnotice--*` | saved, deleted-with-undo, restore-failed; can sit next to the app's agent toasts (bottom right) |

## Layout
- App shell: sidebar plus a content column. Contacts and Cap table share the PageHeader and ListControls (SearchField, PickFilter) and the ui-web Table.

## Inputs
- docs/ux-flow/contacts/report.md lists the decided simplifications; don't re-litigate them.
- docs/ux-walker/contacts/stories/* hold the walker evidence.

## Live and story URLs
- App: demo stack, slot 4 (web port 5377).
- Storybook: static build served locally on port 6120.
