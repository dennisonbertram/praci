import { FakeMeetingSource } from "../../testkit/src/fake-meeting-source.js";
import { runMeetingSourceConformance } from "./meeting-source.conformance.js";

runMeetingSourceConformance(
  "FakeMeetingSource",
  (meetings, { pageSize }) => new FakeMeetingSource(meetings, { pageSize }),
);
