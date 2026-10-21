# Walk J1 (iteration 4): long first-run and daily journeys

Status: NOT WALKED. The mock-data demo stack was not running, so no story could be exercised.

## Evidence
- `curl http://127.0.0.1:5381/` returned no response (connection failed); `curl http://127.0.0.1:3308/` likewise.
- No process was listening on ports 53xx or 33xx.
- `docker ps` failed: the Docker daemon (OrbStack socket) is not running, and `pnpm demo:up` needs Docker for its Postgres container.
- I did not start OrbStack or the demo stack myself (outside the assigned scope), and did not touch :5273 or :3200.

## Story verdicts
| Story | Verdict | Steps actual/ideal |
|---|---|---|
| STORY-APP-144 (first day, phone) / first-run sign-up -> model -> Connect your apps -> tour -> first question (STORY-APP-319) | BLOCKED: demo stack down | -/14 |
| STORY-APP-145 (Monday on the laptop) | BLOCKED: demo stack down | -/12 |
| STORY-INB-022 (first morning, Inbox) | BLOCKED: demo stack down | -/? |
| STORY-INB-109 (Monday-morning inbox reset) | BLOCKED: demo stack down | -/? |
| STORY-FIN-019 / STORY-FIN-036 (runway before a board meeting) | BLOCKED: demo stack down | -/? |

## Findings
None. No findings are invented. Re-run this group after `DEMO_SLOT=<n> pnpm demo:up` is running with Docker/OrbStack started and the web port at 5381 and API at 3308.
