import type { BotPins, BotPinsRefreshOutput, BotPinsSaveOutput, PinList } from "@rakazo/contracts";
import { rpc } from "./api";

export const getPins = (botId: string) => rpc<BotPins | null>("pins/get", { botId });

export const savePins = (botId: string, list: PinList | null, baseRevision: number) =>
  rpc<BotPinsSaveOutput>("pins/save", { botId, list, baseRevision });

export const refreshPins = (botId: string) => rpc<BotPinsRefreshOutput>("pins/refresh", { botId });
