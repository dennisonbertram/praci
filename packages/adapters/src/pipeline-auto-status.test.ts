import { describe, expect, it } from "vitest";
import type {
  AutoStatusEvidence,
  AutoStatusRecord,
  AutoStatusUndone,
} from "./pipeline-auto-status.js";
import {
  decideAutoUpdate,
  selectCalendarEvidenceEvents,
  usableAutoEvent,
} from "./pipeline-auto-status.js";

const NOW = new Date("2027-03-01T12:00:00.000Z");
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
const daysAfter = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

const record = (fields: Partial<AutoStatusRecord> = {}): AutoStatusRecord => ({
  status: "not_reached",
  nextCallAt: null,
  nextCallHasTime: false,
  lastContactAt: null,
  ...fields,
});

const noEvidence: AutoStatusEvidence = {
  sent: null,
  receivedAt: null,
  pastEvent: null,
  statusEvent: null,
  futureEvent: null,
};

const evidence = (fields: Partial<AutoStatusEvidence>): AutoStatusEvidence => ({
  ...noEvidence,
  ...fields,
});

const nothingUndone: AutoStatusUndone = { statuses: new Set(), nextCalls: new Set() };

const sent = { at: daysBefore(3), id: "msg-1", subject: "Intro to Auto Capital" };
const future = { at: daysAfter(10), hasTime: true, id: "evt-1", title: "Call with Auto Capital" };
const past = { at: daysBefore(5), id: "evt-2", title: "Coffee with Auto Capital" };

describe("decideAutoUpdate", () => {
  it("a sent email means Reached out, with the subject as evidence", () => {
    const plan = decideAutoUpdate(NOW, record(), evidence({ sent }), nothingUndone);
    expect(plan.status).toBe("reached_out");
    expect(plan.evidence).toEqual({
      actor: "auto:mail",
      summary: "Intro to Auto Capital",
      at: sent.at,
      id: "msg-1",
    });
  });

  it("a future event means Meeting booked and fills the next call with its time", () => {
    const plan = decideAutoUpdate(NOW, record(), evidence({ futureEvent: future }), nothingUndone);
    expect(plan.status).toBe("meeting_booked");
    expect(plan.nextCall).toEqual({ at: future.at, hasTime: true });
    expect(plan.evidence?.actor).toBe("auto:calendar");
  });

  it("uses an ongoing event for status while filling next call from a later event", () => {
    const ongoing = { at: daysBefore(2), hasTime: false, id: "evt-multi-day", title: "Conference" };
    const plan = decideAutoUpdate(
      NOW,
      record(),
      evidence({ statusEvent: ongoing, futureEvent: future }),
      nothingUndone,
    );
    expect(plan.status).toBe("meeting_booked");
    expect(plan.evidence?.id).toBe(ongoing.id);
    expect(plan.nextCall).toEqual({ at: future.at, hasTime: true });
  });

  it("a past event means Met, ahead of a future event or a sent email", () => {
    const plan = decideAutoUpdate(
      NOW,
      record(),
      evidence({ sent, pastEvent: past, futureEvent: future }),
      nothingUndone,
    );
    expect(plan.status).toBe("met");
    expect(plan.evidence?.summary).toBe("Coffee with Auto Capital");
    // The future call is still picked up.
    expect(plan.nextCall).toEqual({ at: future.at, hasTime: true });
  });

  it("moves forward only: an email does not push a Met record back, nor move one at its rank", () => {
    const met = decideAutoUpdate(NOW, record({ status: "met" }), evidence({ sent }), nothingUndone);
    expect(met.status).toBeNull();
    expect(met.evidence).toBeNull();
    const booked = decideAutoUpdate(
      NOW,
      record({ status: "meeting_booked" }),
      evidence({ futureEvent: future }),
      nothingUndone,
    );
    expect(booked.status).toBeNull();
    expect(booked.nextCall).toEqual({ at: future.at, hasTime: true });
  });

  it("old mail and meetings set Last contact but never move a status", () => {
    const old = { at: daysBefore(45), id: "evt-old", title: "Coffee last quarter" };
    const plan = decideAutoUpdate(
      NOW,
      record(),
      evidence({ sent: { ...sent, at: daysBefore(60) }, pastEvent: old }),
      nothingUndone,
    );
    expect(plan.status).toBeNull();
    expect(plan.lastContactAt).toEqual(old.at);
  });

  it("writes nothing on a second run once the record holds the event, all-day included", () => {
    const allDay = { at: daysAfter(5), hasTime: false, id: "evt-day", title: "Offsite" };
    const first = decideAutoUpdate(NOW, record(), evidence({ futureEvent: allDay }), nothingUndone);
    expect(first.nextCall).toEqual({ at: allDay.at, hasTime: false });
    const second = decideAutoUpdate(
      NOW,
      record({
        status: first.status ?? "not_reached",
        nextCallAt: allDay.at,
        nextCallHasTime: false,
      }),
      evidence({ futureEvent: allDay }),
      nothingUndone,
    );
    expect(second.status).toBeNull();
    expect(second.nextCall).toBeNull();
    expect(second.evidence).toBeNull();
  });

  it("leaves diligence and beyond alone, however strong the evidence", () => {
    for (const status of ["diligence", "committed", "passed"]) {
      const plan = decideAutoUpdate(
        NOW,
        record({ status }),
        evidence({ sent, pastEvent: past, futureEvent: future }),
        nothingUndone,
      );
      expect(plan.status).toBeNull();
    }
  });

  it("keeps a timed future next call; replaces an empty, past or date-only one", () => {
    const timed = decideAutoUpdate(
      NOW,
      record({ nextCallAt: daysAfter(3), nextCallHasTime: true }),
      evidence({ futureEvent: future }),
      nothingUndone,
    );
    expect(timed.nextCall).toBeNull();
    const pastCall = decideAutoUpdate(
      NOW,
      record({ nextCallAt: daysBefore(2), nextCallHasTime: true }),
      evidence({ futureEvent: future }),
      nothingUndone,
    );
    expect(pastCall.nextCall).toEqual({ at: future.at, hasTime: true });
    const planned = decideAutoUpdate(
      NOW,
      record({ nextCallAt: daysAfter(3), nextCallHasTime: false }),
      evidence({ futureEvent: future }),
      nothingUndone,
    );
    expect(planned.nextCall).toEqual({ at: future.at, hasTime: true });
    const allDay = decideAutoUpdate(
      NOW,
      record(),
      evidence({ futureEvent: { ...future, hasTime: false } }),
      nothingUndone,
    );
    expect(allDay.nextCall).toEqual({ at: future.at, hasTime: false });
  });

  it("never re-applies a change the user undid, but still applies what was not undone", () => {
    const undoneStatus: AutoStatusUndone = {
      statuses: new Set(["reached_out"]),
      nextCalls: new Set(),
    };
    const blocked = decideAutoUpdate(NOW, record(), evidence({ sent }), undoneStatus);
    expect(blocked.status).toBeNull();
    expect(blocked.evidence).toBeNull();
    const undoneCall: AutoStatusUndone = {
      statuses: new Set(),
      nextCalls: new Set([future.at.toISOString()]),
    };
    const skipped = decideAutoUpdate(NOW, record(), evidence({ futureEvent: future }), undoneCall);
    expect(skipped.status).toBe("meeting_booked");
    expect(skipped.nextCall).toBeNull();
    // A different status target is not covered by the undo.
    const allowed = decideAutoUpdate(
      NOW,
      record(),
      evidence({ sent, pastEvent: past }),
      undoneStatus,
    );
    expect(allowed.status).toBe("met");
  });

  it("last contact is the newest of sent, received and past event, only when newer", () => {
    const plan = decideAutoUpdate(
      NOW,
      record(),
      evidence({ sent, receivedAt: daysBefore(1), pastEvent: past }),
      nothingUndone,
    );
    expect(plan.lastContactAt).toEqual(daysBefore(1));
    const stale = decideAutoUpdate(
      NOW,
      record({ lastContactAt: daysBefore(0.5) }),
      evidence({ sent }),
      nothingUndone,
    );
    expect(stale.lastContactAt).toBeNull();
    const none = decideAutoUpdate(NOW, record(), noEvidence, nothingUndone);
    expect(none.lastContactAt).toBeNull();
    expect(none.status).toBeNull();
    expect(none.nextCall).toBeNull();
  });
});

describe("usableAutoEvent", () => {
  const own = new Set(["founder@startup.test"]);
  const event = {
    id: "evt-9",
    summary: "  Sync with Auto Capital  ",
    status: "confirmed",
    start: { dateTime: "2027-03-10T15:00:00.000Z" },
    organizer: { email: "founder@startup.test" },
    attendees: [
      { email: "founder@startup.test", responseStatus: "accepted", self: true },
      { email: "Partner@AutoCapital.test", responseStatus: "accepted" },
    ],
  };

  it("keeps a confirmed event: title trimmed, other people's emails lowercased, own out", () => {
    const usable = usableAutoEvent(event, own);
    expect(usable).toMatchObject({
      id: "evt-9",
      title: "Sync with Auto Capital",
      hasTime: true,
    });
    expect([...(usable?.emails ?? [])]).toEqual(["partner@autocapital.test"]);
  });

  it("drops cancelled events and events the user declined, by self flag or own address", () => {
    expect(usableAutoEvent({ ...event, status: "cancelled" }, own)).toBeNull();
    const selfDeclined = {
      ...event,
      attendees: [
        { email: "founder@startup.test", responseStatus: "declined", self: true },
        { email: "partner@autocapital.test", responseStatus: "accepted" },
      ],
    };
    expect(usableAutoEvent(selfDeclined, own)).toBeNull();
    const declinedByAddress = {
      ...event,
      attendees: [
        { email: "Founder@Startup.test", responseStatus: "declined" },
        { email: "partner@autocapital.test", responseStatus: "accepted" },
      ],
    };
    expect(usableAutoEvent(declinedByAddress, own)).toBeNull();
    const guestDeclined = {
      ...event,
      attendees: [
        { email: "founder@startup.test", responseStatus: "accepted", self: true },
        { email: "partner@autocapital.test", responseStatus: "declined" },
      ],
    };
    expect(usableAutoEvent(guestDeclined, own)).not.toBeNull();
  });

  it("leaves out a guest who declined", () => {
    const event = usableAutoEvent(
      {
        id: "evt-d",
        summary: "Pitch",
        start: { dateTime: "2027-03-05T15:00:00Z" },
        attendees: [
          { email: "Gone@Fund.test", responseStatus: "declined" },
          { email: "here@fund.test", responseStatus: "accepted" },
        ],
      },
      new Set(),
    );
    expect(event?.emails).toEqual(new Set(["here@fund.test"]));
  });

  it("an all-day event has a date start at midnight UTC and no time", () => {
    const usable = usableAutoEvent({ ...event, start: { date: "2027-03-11" } }, own);
    expect(usable?.hasTime).toBe(false);
    expect(usable?.at.toISOString()).toBe("2027-03-11T00:00:00.000Z");
    // Without a timeZone the day ends at UTC midnight, as before.
    expect(usable?.endsAt.toISOString()).toBe("2027-03-12T00:00:00.000Z");
  });

  it("ends an all-day event at midnight in the time zone the event carries", () => {
    // March 2027 is still PST (UTC-8): the March 11 date ends at 08:00Z on the 12th.
    const west = usableAutoEvent(
      {
        ...event,
        start: { date: "2027-03-11", timeZone: "America/Los_Angeles" },
      },
      own,
    );
    expect(west?.at.toISOString()).toBe("2027-03-11T00:00:00.000Z");
    expect(west?.startsAt.toISOString()).toBe("2027-03-11T08:00:00.000Z");
    expect(west?.endsAt.toISOString()).toBe("2027-03-12T08:00:00.000Z");
    // UTC+14: the same date ends at 10:00Z on the 11th.
    const east = usableAutoEvent(
      {
        ...event,
        start: { date: "2027-03-11", timeZone: "Pacific/Kiritimati" },
        end: { date: "2027-03-12", timeZone: "Pacific/Kiritimati" },
      },
      own,
    );
    expect(east?.endsAt.toISOString()).toBe("2027-03-11T10:00:00.000Z");
    expect(east?.startsAt.toISOString()).toBe("2027-03-10T10:00:00.000Z");
  });

  it("runs a multi-day all-day event to its exclusive end date in its time zone", () => {
    // March 2027 is still EST (UTC-5): an event dated the 9th through the 11th ends at 05:00Z
    // on the 12th, its exclusive end.date.
    const usable = usableAutoEvent(
      {
        ...event,
        start: { date: "2027-03-09", timeZone: "America/New_York" },
        end: { date: "2027-03-12", timeZone: "America/New_York" },
      },
      own,
    );
    expect(usable?.endsAt.toISOString()).toBe("2027-03-12T05:00:00.000Z");
  });

  it("a timed event is past once it starts, and a bad all-day zone falls back to UTC", () => {
    const usable = usableAutoEvent(event, own);
    expect(usable?.endsAt).toEqual(usable?.at);
    const odd = usableAutoEvent(
      { ...event, start: { date: "2027-03-11", timeZone: "Nowhere/Zone" } },
      own,
    );
    expect(odd?.endsAt.toISOString()).toBe("2027-03-12T00:00:00.000Z");
  });

  it("drops entries without an id or a usable start", () => {
    expect(usableAutoEvent({ ...event, id: undefined }, own)).toBeNull();
    expect(usableAutoEvent({ ...event, start: {} }, own)).toBeNull();
    expect(usableAutoEvent(null, own)).toBeNull();
  });
});

describe("selectCalendarEvidenceEvents", () => {
  it("keeps an ongoing event for status without letting its old start mask the next call", () => {
    const person = new Set(["partner@autocapital.test"]);
    const ongoing = {
      id: "evt-multi-day",
      title: "Conference",
      startsAt: daysBefore(2),
      at: daysBefore(2),
      endsAt: daysAfter(2),
      hasTime: false,
      emails: person,
    };
    const nextCall = {
      id: "evt-friday",
      title: "Friday call",
      startsAt: daysAfter(4),
      at: daysAfter(4),
      endsAt: daysAfter(4),
      hasTime: true,
      emails: person,
    };

    expect(selectCalendarEvidenceEvents([ongoing, nextCall], person, NOW)).toEqual({
      pastEvent: null,
      statusEvent: ongoing,
      futureEvent: nextCall,
    });
  });

  it("uses zoned all-day start instants around both negative and positive UTC offsets", () => {
    const westEvent = usableAutoEvent(
      {
        id: "evt-la-all-day",
        summary: "Los Angeles event",
        start: { date: "2027-03-11", timeZone: "America/Los_Angeles" },
        end: { date: "2027-03-12", timeZone: "America/Los_Angeles" },
        attendees: [{ email: "partner@autocapital.test" }],
      },
      new Set(),
    );
    const eastEvent = usableAutoEvent(
      {
        id: "evt-kiritimati-all-day",
        summary: "Kiritimati event",
        start: { date: "2027-03-11", timeZone: "Pacific/Kiritimati" },
        end: { date: "2027-03-12", timeZone: "Pacific/Kiritimati" },
        attendees: [{ email: "partner@autocapital.test" }],
      },
      new Set(),
    );
    const partner = new Set(["partner@autocapital.test"]);

    // At 10 p.m. in Los Angeles, the UTC calendar date has started but local midnight has not.
    expect(
      selectCalendarEvidenceEvents([westEvent!], partner, new Date("2027-03-11T06:00:00Z"))
        .futureEvent?.id,
    ).toBe("evt-la-all-day");
    // At 1 a.m. in Kiritimati, UTC midnight is still ahead but the event has already started.
    const east = selectCalendarEvidenceEvents(
      [eastEvent!],
      partner,
      new Date("2027-03-10T11:00:00Z"),
    );
    expect(east.futureEvent).toBeNull();
    expect(east.statusEvent?.id).toBe("evt-kiritimati-all-day");
  });
});
