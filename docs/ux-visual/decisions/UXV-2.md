# UXV-2 Inbox retry loses focus and gives no result — decision

Chosen:
- Try again stays focusable while busy: `aria-disabled` plus an early return instead of `disabled`, so focus stays on the button during and after a retry.
- The notice stops telling people to wait over a live button: "Gmail is limiting requests right now." (drops "Try again in a few seconds.").
- A retry that fails again says so: "Gmail is still limiting requests." replaces the line, in the existing live region, so it is seen and announced. This also closes #161.
- The rate-limit notice uses the warning status colour whether or not mail is cached; destructive stays for reconnect (an account that needs action).

Rejected: auto-retry with a countdown (more moving parts; the pause length isn't known to the client).

Acceptance: `document.activeElement` is the Try again button during and after a retry; after a failed retry the text changes and is inside a live region; no layout shift (button width unchanged); rate-limit notice colour is the warning token in both cached and empty states.
