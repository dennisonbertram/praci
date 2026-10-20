import type { Me } from "@rakazo/contracts";
import * as SecureStore from "expo-secure-store";
import { rpc } from "./api";

const REPORTED_KEY = "rakazo.timezoneReported";

/**
 * Tell the server this device's IANA time zone so agents and new schedules use local time. Sends
 * only when the server has none or the device zone changed since this device last reported, so a
 * zone chosen in web settings stays until the device travels.
 */
export async function reportTimezone(): Promise<void> {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) return;
  const me = await rpc<Me>("me");
  const stamp = `${me.userId}:${zone}`;
  const last = await SecureStore.getItemAsync(REPORTED_KEY).catch(() => null);
  if (me.timezone !== null && last === stamp) return;
  if (me.timezone !== zone) await rpc("preferences/update", { timezone: zone });
  await SecureStore.setItemAsync(REPORTED_KEY, stamp).catch(() => undefined);
}
