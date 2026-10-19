import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { rpc } from "./api";

const LAST_TOKEN_KEY = "rakazo.pushToken";

export async function registerPushToken() {
  const existing = await Notifications.getPermissionsAsync();
  const granted = existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;
  try {
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return;
    // The server removes this device's old token only when told it was replaced.
    const previous = await SecureStore.getItemAsync(LAST_TOKEN_KEY).catch(() => null);
    await rpc("notifications/registerPush", {
      token,
      ...(previous && previous !== token ? { replacesToken: previous } : {}),
    });
    await SecureStore.setItemAsync(LAST_TOKEN_KEY, token).catch(() => undefined);
  } catch {
    // Expo Go cannot mint an ExponentPushToken without an EAS project id.
  }
}

export async function unregisterPushToken() {
  await rpc("notifications/unregisterPush").catch(() => undefined);
}
