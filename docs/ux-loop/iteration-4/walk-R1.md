# Walk R1 (uxl4-R1): verification of pass-3 clusters

Status: the walk did not run. The mock-data demo stack was not up, so no cluster was verified.

Observed at start:
- `curl http://127.0.0.1:5381/` and `http://127.0.0.1:3308/` returned no connection (HTTP 000).
- No process listened on ports 53xx or 33xx.
- `docker ps` failed: the OrbStack Docker daemon is not running.
- The worktree `rakazo-uxloop4` has no `node_modules`.

I did not start Docker or install dependencies. That is outside this walker's scope, and the instructions allow only the demo stack on 5381. I did not open :5273 or :3200.

To run this walk: start OrbStack, then run `pnpm install` and `pnpm demo:up` (with a free `DEMO_SLOT` that maps to web 5381 / API 3308) from `rakazo-uxloop4`, then re-launch R1.

## Verdicts

- C1: BLOCKED (demo stack not running), steps n/a
- C2: BLOCKED (demo stack not running), steps n/a
- C9: BLOCKED (demo stack not running), steps n/a
- C14: BLOCKED (demo stack not running), steps n/a
- C3: BLOCKED (demo stack not running), steps n/a
- C4: BLOCKED (demo stack not running), steps n/a
- C5: BLOCKED (demo stack not running), steps n/a
- C6: BLOCKED (demo stack not running), steps n/a
- C15: BLOCKED (demo stack not running), steps n/a
- C26: BLOCKED (demo stack not running), steps n/a
- C11: BLOCKED (demo stack not running), steps n/a
- C24: BLOCKED (demo stack not running), steps n/a
- C7: BLOCKED (demo stack not running), steps n/a
- C8: BLOCKED (demo stack not running), steps n/a
- C16: BLOCKED (demo stack not running), steps n/a
- C10: BLOCKED (demo stack not running), steps n/a
- C12: BLOCKED (demo stack not running), steps n/a
- C13: BLOCKED (demo stack not running), steps n/a
- C17: BLOCKED (demo stack not running), steps n/a
- C18: BLOCKED (demo stack not running), steps n/a
- C19: BLOCKED (demo stack not running), steps n/a
- C23: BLOCKED (demo stack not running), steps n/a
- C25: BLOCKED (demo stack not running), steps n/a
- C28: BLOCKED (demo stack not running), steps n/a
- C20: BLOCKED (demo stack not running), steps n/a
- C21: BLOCKED (demo stack not running), steps n/a
- C22: BLOCKED (demo stack not running), steps n/a
- C27: BLOCKED (demo stack not running), steps n/a

## Findings

| id | story/page | severity | category | what happened | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R1-01 | all clusters | P1 (process) | perf | Demo stack on 5381/3308 not running; Docker daemon down; no node_modules in worktree. Observed. | curl 000 on both ports; docker ps error | n/a | Start OrbStack and `pnpm demo:up` in the worktree before launching walkers. |
