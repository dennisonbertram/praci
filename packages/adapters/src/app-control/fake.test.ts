import { appControlStoreContract } from "./app-control-store.test-support.js";
import { InMemoryAppControlStore } from "./fake.js";

appControlStoreContract("InMemoryAppControlStore", () => new InMemoryAppControlStore());
