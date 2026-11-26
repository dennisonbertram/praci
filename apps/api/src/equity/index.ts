import type { RouteContext } from "../routes/context.js";
import { accessRoutes } from "./access.js";
import { documentLinkRoutes } from "./access-documents.js";
import { accessHolderRoutes } from "./access-holders.js";
import { accessViewRoutes } from "./access-view.js";
import { optionRoutes } from "./options.js";
import { optionAreaRoutes } from "./options-area.js";
import { overviewRoutes } from "./overview.js";
import { roundRoutes } from "./rounds.js";
import { securityRoutes } from "./securities.js";
import { shareTransactionRoutes } from "./securities-transactions.js";
import { shareClassRoutes } from "./share-classes.js";
import { stakeholderRoutes } from "./stakeholders.js";
import { stakeholderAreaRoutes } from "./stakeholders-actions.js";
import { viewRoutes } from "./views.js";

/**
 * The `equity` namespace of the router: one routes module per entity group. An area adds its
 * procedures to the contract (packages/contracts/src/equity/rpc.ts) and spreads its own routes
 * module here, in its marked line.
 */
export function createEquityRoutes(context: RouteContext) {
  return {
    // ---- foundation ----
    ...overviewRoutes(context),
    ...stakeholderRoutes(context),
    ...shareClassRoutes(context),
    ...securityRoutes(context),
    ...optionRoutes(context),
    ...roundRoutes(context),
    ...accessRoutes(context),
    // ---- stakeholders area ----
    ...stakeholderAreaRoutes(context),
    // ---- securities area ----
    ...shareTransactionRoutes(context),
    // ---- options area ----
    ...optionAreaRoutes(context),
    // ---- views area ----
    ...viewRoutes(context),
    // ---- access area ----
    ...accessViewRoutes(context),
    ...accessHolderRoutes(context),
    ...documentLinkRoutes(context),
  };
}
