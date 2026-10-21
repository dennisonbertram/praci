# Brief

Praci is a planned native SwiftUI iPhone app (Liquid Glass style) for a startup founder who runs a company with AI bots ("agents"). These are static design boards on a standard iPhone (393x852 pt); each board is a grid of labeled states.

Rules: glass only on floating nav and controls; content is solid; at most three glass groups per view; exactly one tinted prominent action per view; concentric corners; touch targets 44 pt.

Persona: a busy founder, one hand, checking the company between meetings. Wants to see what needs attention, answer or approve in a tap or two, and talk to a bot.

Screens and journey step:
- PH-Home: landing. Left Connected, right No model. See activity, open Inbox or a page, chat with a bot, start something new.
- PH-Spaces: Home with the space menu open, and the switching state.
- PH-Inbox: triage mail (swipe, undo, errors, empty, reconnect, consent, first sync).
- PH-Thread: chat with the Inbox agent which drafted a reply; approve with Send; menus and draft states.
- PH-GroupThread: chat with two bots in the Funding room, plus the chat menu.
- PH-Computer: watch the team's shared computer, take control, release; error states.
