# Iteration 23, visual group V1 (shell, auth, onboarding, tour, Settings, Integrations, bot settings)

Session uxl23-V1, mock-data demo stack only. Date 2026-10-23. Screenshots were kept outside the repo; file names below refer to that folder.

Method: layout-audit and geometry-audit run at each page and viewport, then hands-on checks (hover, Tab order, menus, dialogs, Escape, long text, light theme). Touch measurements used CDP touch emulation (pointer: coarse). Fresh users were signed up with invented addresses. The demo has a default model and no setup-needing integration, so the model step and "Connect your apps" never appeared (see "Not reached").

Pages walked: landing, sign-in (plus wrong-password error), sign-up (plus short-password error), reset password, first-run Chief chat, first-run tour (desktop and phone), app shell and sidebar (Pages, Create menu, account menu), bot settings panel, Settings (General, Chat display, Privacy and approvals, Models, Voice, Memory), Integrations (list, connect, Kraken dialog), 404 page, light theme.

## Verdicts

| Page | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Landing | Pass. Centered, one primary action. | Not captured separately (sign-in at 375 passes). | n/a |
| Sign-in / sign-up / reset | Pass. Error text uses a reserved row (no layout shift) and inputs keep their values. Minor gap finding V1-05. | Pass. No horizontal scroll, 44 px targets. | n/a |
| First-run Chief chat | Pass. Card and welcome message fit one screen. | Pass. | n/a |
| First-run tour | Pass with P3 (V1-09). Ring on the named item, fixed card, 9 stops. | Pass. The drawer opens by itself and the ring shows on Search, Create, Account. | n/a |
| App shell and sidebar | Pass. No page scroll, panels scroll inside. | Pass with P2 (V1-01). | Pass. No page scroll (pageScrollY 0). |
| Bot settings panel | Pass. Quiet, short. P3 items V1-02, V1-03, V1-04. | Pass. Full-screen sheet, readable, 44 px rows. | n/a |
| Settings | Pass. Fixed height, inner scroll, focus returns to the account button after Escape. P3 items V1-06, V1-07, V1-13. | Pass. Section select plus Close, 44 px controls. | n/a |
| Integrations | Pass. P3 items V1-08, V1-10, V1-11. | Pass. Chips and buttons measure 44 px under touch. | n/a |
| Light theme (Integrations, Settings) | Pass. No contrast problems seen. | Not walked. | n/a |

Measured: pageScrollX 0 everywhere; pageScrollY 0 on every app surface at 1440x900, 375x812 and 1920x1080. The contrast flags from layout-audit on the sidebar (ratio about 1.3) come from transparent ancestor backgrounds and were not real when checked by eye; they are not findings.

## Pass-22 clusters re-checked (V1 scope)

| Earlier item | Result now |
|---|---|
| `/app/settings` opens Settings | Fixed: opened Settings 1 of 1 at 1440 (route resolves to the current chat with the dialog open). |
| Chat display reflows Settings | Fixed: expanding it pushes the Language card down, nothing jumps columns. |
| Tour on phone with drawer closed | Fixed: the tour opens the drawer. |
| Switch off-state boundary | Fixed: track border is clearly visible, thumb plus track distinguish state. |
| Notifications card without heading | Fixed: card is titled "Notifications". |
| "Memory provider" label | Fixed. |
| Kraken dialog placeholder-only labels | Fixed: visible "API key" and "Private key" labels. |
| Disabled "Connect API key" looks enabled | Fixed on the Model tab. A different disabled style remains on the Voice tab (V1-06). |
| Landing button pair off-center | Fixed: the pair is centered. |
| Lone "..." row per message on phone | Still present (V1-01). |
| Tour card empty band and distance | Band still present (V1-09); fixed spot is an owner decision. |
| Connected card action order differs from Popular | Still present (not re-raised, same as earlier V1-15). |
| Phone drawer: Pages vs chat list | Pages are collapsible and the state persists; with 13 chats not re-tested. |

## Findings

No P0 or P1 findings. Everything below was observed unless marked suspected.

| id | page | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| V1-01 | Chat, phone (touch) | P2 | visual | Each message still gets its own row for the lone "..." button, about 28 px per message, so a thread is roughly a fifth taller. Expected: the "..." sits inline with the timestamp or the bubble (D5). Observed with pointer: coarse; with a fine pointer the row does not exist. | 15-shell-375.png | `apps/web/src/components/MessageHoverMetadata.tsx` and the message action row in `apps/web/src/pages/Shell.tsx` | Put the "..." on the timestamp line or overlay it on the bubble corner on touch. |
| V1-02 | Chat header, long bot name | P3 | visual | A 90-character bot name is clipped at the header edge with no ellipsis ("...Northwind R"), while the sidebar row, the settings panel title and the composer placeholder all end in an ellipsis (H5, C4). The Name field has no length limit. | 27-longname-1440.png | chat header title in `apps/web/src/pages/Shell.tsx` (title button next to the avatar) | Add `truncate` with a title attribute to the header title and cap the name field at about 60 characters. |
| V1-03 | Bot settings, rename | P3 | bug | Renaming a bot with no new messages changed its sidebar time from 9:15 AM to 9:28 AM, so the time reads as activity that did not happen (C3). | 27-longname-1440.png vs 08-newbot-1440.png | bot list sort and time field in the sidebar (`apps/web/src/pages/Shell.tsx`), probably `updatedAt` | Show the last message time, not the bot's update time. Observed; cause suspected. |
| V1-04 | Bot settings | P3 | flow | The green "Saved" badge appeared after only moving focus out of an untouched Name field (opening "More settings"). Expected: no confirmation when nothing changed (I2, C3). | 09-botsettings-1440.png | bot settings panel autosave on blur | Skip the save and the badge when the value equals the stored one. |
| V1-05 | Sign-in, reset password | P3 | visual | "Forgot password?" sits 54 px under the password field and the error row reserves 23 px more, so the link floats between the field and the button (D4). The reset page has a 54 px gap between the email field and "Send reset link" for the same reason. | 02-signin-1440.png, 22-forgot-1440.png | `apps/web/src/pages/Auth.tsx` lines about 345 to 365 (`min-h-5` error rows, `mb-3 mt-1`) | Tighten the reserved error row to the single line it needs and pull the link up to the field. |
| V1-06 | Settings, Models | P3 | visual | Two small inconsistencies (H5, L4): the Model tab provider list is 310 px wide and the Voice tab list 280 px, so the right column starts at different x (754 vs 724); the disabled primary on Voice ("Connect ElevenLabs") is a filled grey button while the disabled buttons on the Model tab are dim text without fill. | 13-settings-models-own-1440.png, 13-settings-voice-1440.png | `apps/web/src/pages/ModelSettingsOverlay.tsx` | Use one list width and one disabled button style for both tabs. |
| V1-07 | Settings, Models | P3 | copy | After "Use my own model" the page says "Your bots use OpenAI: GPT-6 Luna." while the provider list marks "OpenRouter Included" with a check. A first-time founder cannot tell who provides the model (C1). | 13-settings-models-own-1440.png | `apps/web/src/pages/ModelSettingsOverlay.tsx` | Mark the row for the active model's provider, or say "Included with Praci" in place of a provider name. |
| V1-08 | Integrations, Kraken dialog | P3 | a11y | The "Create a key with only Query Funds" help line is a link but has no underline and the same colour as plain help text (I1); its target is 352x16. "Connect" is enabled with both fields empty. | 17-connect-kraken-1440.png | `apps/web/src/components/integrations/ExchangeConnectDialog.tsx` lines about 30 to 34 | Underline the link and give it 24 px height; disable "Connect" until both fields have text. |
| V1-09 | First-run tour | P3 | visual | The text block keeps a fixed 40 px height, so one-line steps leave an empty band above the buttons; on the last step the card sits directly above "Integrations" while the ring is on the account row below it. The fixed spot itself is an owner decision and is not re-raised. | 06-tour4-1440.png, 06-tour-end-1440.png | `apps/web/src/components/tour/TourPopover.tsx` line about 202 (`min-h-10`) | Remove the min height and keep only the button row fixed. |
| V1-10 | Integrations | P3 | visual | The search field is 420 px wide above a 1068 px card grid, so it aligns with the left edge only (L4). | 16-integrations-1440.png | Integrations page layout | Make the search field span the grid or keep it with the chips on one row. |
| V1-11 | Integrations, connect | P3 | flow | A one-click connect moves the card from its section to a new "Connected" section at the top with no toast. A person who clicked lower in a long page may not see anything happen (suspected: I observed it only at scroll 0; the card moved 188 px up and the page shifted). | 17-connect-mercury-1440.png | Integrations list grouping | Scroll the connected card into view, or flash it, after a connect. |
| V1-12 | Create menu | P3 | a11y | The Create menu is exposed to assistive technology as a listbox named "Suggestions" with options, not as a menu (suspected cause: shared autocomplete component). Names and Escape work. | 07-create-menu-1440.png (snapshot) | Create popover in `apps/web/src/pages/Shell.tsx` | Give the popover `role=menu` with `menuitem` rows, or label the listbox "Create". |
| V1-13 | Settings, General | P3 | visual | "Delete account" is a solid red-tinted pill, about as prominent as the only primary-style control on the page, "Request export" (H2). | 11-settings-general-1440.png | Settings General account card | Make it a text-weight destructive button and keep the confirmation step. |

## Not reached or not verified

- Onboarding model step and "Connect your apps": the demo has a default model and no setup-needing integration, so neither step appeared for two fresh users. Not judged.
- Tapping the phone hamburger through the automation tool with CDP touch emulation did not open the drawer, but a scripted click did; the same tap works with a fine pointer after a reload. Treated as an emulation limit, not a product bug. A real device check is still open.
- Phone: reset password heading wrap, Chief space-header fade over the chat list, the Connected vs Popular card action order, 13-chat drawer, light theme at 375.
- Real OAuth connections (Gmail, Calendar, Drive): not attempted (blocked by rule).
- Mercury was connected in the mock stack on the walker's own account.

## Excellent as is

- Landing: one headline, one primary action, centered, no clutter.
- Auth forms: errors appear in a reserved row (no shift), inputs keep their values, 44 px controls on phone, show-password toggle, clear focus rings.
- First-run: the "What should I work on first?" card is compact and dismissible, the tour then offers itself, and on phone it opens the drawer for the person.
- Tour: stable 140 px card, ring on the named item, 9 stops, Back, Skip, "Ask Chief" on the last stop.
- Shell: no page scroll at 1440, 1920 or 375, panels scroll inside, "Skip to content" and "Skip to message box" exist, focus returns to the account button when Settings closes, the Pages list is a single Tab stop.
- Create menu: only "New bot" and "New group chat" for a one-space account.
- Bot settings panel: short, clear, "Off in Settings" for notifications, Audience as a two-option control, no Title field, autosave on blur.
- Settings: four short sections (General, Privacy and approvals, Models, Advanced with Memory), fixed height with inner scroll, "Chat display" expands without reflow, Memory empty state is one line, switch states are readable.
- Integrations: a compact filter and search, popular first, clear connected section, 44 px chips and buttons on touch.
- Light theme: clean surfaces and borders, no contrast regressions.
- 404 page: plain words and one button.
