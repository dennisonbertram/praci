# Boat as a computer provider: evaluation

Status: documentation research only, 2026-10-19. Nothing here has been measured against the live
service. Sources: <https://docs.boat.dev/llms-full.txt>, the OpenAPI file at
<https://docs.boat.dev/openapi/boat-v1.yaml>, <https://docs.boat.dev/pricing>, and the type
definitions of `@boatdev/sdk@1.10.0`. Boat's comparison with E2B comes from Boat's own page.

## Verdict

Worth watching, not an adapter yet. Compute is much cheaper than E2B, but Boat has no
memory-preserving pause and no screenshot or input API. A Rakazo computer would cold-boot its
desktop and Chrome on every wake. The adapter would also have to provide screen control,
view-only screens and egress rules itself.

The deciding measurement is the time from resume until the desktop is streaming with Chrome open.
A few seconds would justify an adapter. Tens of seconds would not.

## Fit against `SandboxProvider`

The interface is in `packages/adapter-kit/src/interfaces.ts`, and the E2B adapter is
`packages/adapters/src/e2b-sandbox.ts`.

| Operation | Boat | Notes |
| --- | --- | --- |
| `provision`, `destroy` | Yes | REST and SDK create and delete. |
| `stop`, resume | Partial | Stop removes the VM and keeps the disk. Memory and running programs are lost: "Desktop programs do not survive a resume or a fork." |
| `keepAlive` | Yes | Auto-stop defaults to 1 hour, can be set up to 30 days, or turned off. |
| `execute` | Yes | `POST /commands` streams NDJSON. The timeout is 1 to 600 s (default 30 s). Detached commands are unlimited. |
| `listFiles`, `readFile`, `writeFile` | Yes | File API. |
| `snapshot`, export and import | Yes | Disk snapshots. `/tmp`, `~/.cache` and running programs are not saved. |
| `connectScreen` | Partial | The desktop URL is an iframe stream at 1920x1080 and 60 fps. It must be opened within 10 minutes, and anyone with the URL has full control. No view-only mode is documented. |
| `connectTerminal` | No | No PTY or web terminal API. SSH only. |
| `observe`, `act`, `sendInput` | No | Screenshot, mouse, keyboard and clipboard tools exist only as an in-sandbox MCP server for Boat's own agent harnesses. Running `xdotool` or `scrot` through `execute` is an untested workaround. |

## Cost and limits

- Rates per hour, billed per second:
  - `small` (2 vCPU, 4 GB): $0.018.
  - `default` (4 vCPU, 8 GB): $0.036. A full month is about $26.
  - `large` (8 vCPU, 16 GB): $0.072.
  - `xlarge` (16 vCPU, 32 GB): $0.200.
- Plans are $20, $100, $500 and $2000 per month, and each plan's price comes back as sandbox time. There are no egress charges, and a stopped sandbox is free.
- A stopped disk is deleted after 14 days. Named snapshots persist, and the first 10 are free.
- On the $20 plan, limits are 100 concurrent sandboxes and 12 starts per minute. A resume counts as a start.
- Hosting is EU only (Germany, Finland, France). "Snapshot copies can be stored outside the EU."
- SOC 2 is "in progress", and no SLA is documented. Boat's platform guide says resale is allowed without approval.

## Security gaps for a hosted service

- Outbound traffic is open. The only control is iptables inside the sandbox, and those rules reset on resume.
- The docs do not mention blocking the cloud metadata address.
- The IP address can change on resume.
- Desktop stream URLs are bearer secrets that grant interactive control.

## Questions sent to Boat

1. Is there a view-only mode for the desktop stream?
2. Is there a supported API for screenshot, mouse, keyboard and clipboard?
3. What are the p50 and p99 times from resume until the desktop is streaming with Chrome open? Can the desktop and Chrome start automatically on resume?
4. Is a memory-preserving pause on the roadmap?
5. Can egress and the metadata address be blocked at the platform level? Is a fixed egress IP available?
6. Can the 14-day disk expiry and the start-rate limits be raised for committed accounts?
7. Is there an SLA, a SOC 2 date, and an option to keep snapshots in the EU?

## Next step

Run a timing probe with an API key. It should measure create, exec streaming, a 5 MB file round
trip, and three stop and resume cycles, and check what survives each resume (files, background
processes, Chrome) and whether the metadata address is reachable. Record the results here.
