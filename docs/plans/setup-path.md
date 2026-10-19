# Setup path gaps (proposal)

Status: proposal. Nothing here is implemented. Written against `main` while documenting the Data room embedding model. The current path is in [Setting up from scratch](../data-room/README.md#setting-up-from-scratch).

## Gaps, ranked by value over effort

| # | Gap today | Proposed fix | Value | Effort |
|---|---|---|---|---|
| 1 | A wrong-size or rejected embedding model fails silently. The index step swallows the error, items stay keyword-only, and no screen says why. | When the embedder throws, store a short reason on the space's Data room status and show it next to the **Data room search model** field and on the Data room page. | High | Small |
| 2 | Done in #218: built-in OpenRouter and OpenAI connections now get an embedder without the public-endpoint flag. | None | Done | Done |
| 3 | The embedding field is hidden in a disclosure with no suggestion. | When the default connection supports one, prefill a recommended model (for example `text-embedding-3-small` on OpenAI or OpenRouter, `mxbai-embed-large` on Ollama) and offer it as one click. | High | Small |
| 4 | Nothing shows which parts are on. A user cannot tell if OCR, meaning search, consent, the worker or Google sync is working. | A setup checklist in Settings (or on the Data room page while incomplete) with on/off for: model, vision, embedding, consent, storage, worker, Google. Hide it when all are on. | High | Medium |
| 5 | A stopped worker looks like a slow app: items stay pending forever. | Worker heartbeat in Postgres and a banner "Background processing is not running" when it is stale. | Medium | Small |
| 6 | Changing the embedding model does nothing until consent is re-accepted, with no prompt after saving. | After saving, open the consent prompt or show a "Review data sharing to re-index" action. | Medium | Small |
| 7 | Vision support is a manual **Supports images** toggle per connection, easy to miss, and the effect is silent skipping of images and scans. | Count items skipped for lack of vision and show "N images not read" with a link to the setting. | Medium | Small |
| 8 | Setup is spread over the README, self-host guide, `.env.example` and the Data room plan. | Keep the single checklist in this repo's Data room doc and link to it from the README and installer output. | Low | Small |
| 9 | S3 or MinIO bucket creation and the `RAKAZO_S3_*` set are manual, and a partial set stops startup. | Add an optional MinIO service and bucket-init step to the Compose files, off by default. | Low | Medium |

Gaps 1, 3 and 4 would remove most first-run confusion; 1 and 3 can ship first because they touch only the model settings and the index step.
