# J1 proposal C: inline disclosure under the primary button, just-in-time permissions

Pattern: the footer disclosure under a primary button, as in Apple's Sign in with Apple and iOS Settings sign-in forms, plus just-in-time permission prompts for optional capabilities (Messages and Camera ask for the microphone when first used). Linear and Things connect an account in one sheet and never ask a second time.

- Connect is consent. The Connect sheet gets one footer line under the button naming the provider and the data: "Connecting sends your messages and attachments to Model A to run your agents. Privacy details". The Connect press is the explicit permission. "Privacy details" is a link-styled text. Withdrawal stays in Settings > AI data sharing.
- The separate "Share data with Model A?" sheet on first send is deleted. Speech and Memory keep their own prompt the first time each is used (mic tap, memory write). PG-B-Consent's left panel becomes that prompt: "Share recordings with Speech A?" Allow / Not now.
- Connect sheet: provider rows with plain SF Symbols instead of letter tiles; "Recommended" caption on the first row; labelled field that changes per row (API key / Server address / none with the button reading "Sign in"). For Local server the footer reads "Messages stay on this server." Wrong key: red outline and line "Key not accepted." under the field, sheet stays open, Connect enabled.
- After connecting: card "Model A connected." with the one prominent button "Message Chief". Card goes away after the first message or one tap. "+" is hidden until a model is connected (nothing it creates works without one).
- No-model Chief row: dimmed, subtitle "Connect a model to chat". If opened and a message is sent: bubble with red outline, "Not sent: No model connected", action "Connect" (opens the sheet; the message sends when connection succeeds).
- Empty first thread: Chief greeting "Hello! How can I help?", three suggestion pills, focused composer.
- PH-Home gets the same no-model variant (card above Inbox, Activity hidden, Chief dimmed).
- Settings toggles: footer under the group, "Turning off Model A pauses all agents." plus a confirm alert on turn-off.

Cost: one new footer line of copy (required by disclosure rules) and a removed sheet; small build.
