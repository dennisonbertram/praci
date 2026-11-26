export { AgentDesktopAppControl } from "./agent-desktop.js";
export { createAppControlProvider } from "./factory.js";
export { FAKE_APPS, FakeAppControl, InMemoryAppControlStore } from "./fake.js";
export type { AgentDesktopRunner, AgentDesktopRunResult } from "./runners.js";
export {
  AgentDesktopNotInstalledError,
  bridgeAgentDesktopRunner,
  spawnAgentDesktopRunner,
} from "./runners.js";
