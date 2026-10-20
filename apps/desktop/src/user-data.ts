import path from "node:path";

/**
 * Electron derives the default userData directory from the app name, which comes from
 * `productName`. The product is now called Praci, but existing installs keep their data
 * (setup file, local stack, cookies) under the directory named after the old product name.
 */
export const LEGACY_USER_DATA_DIR_NAME = "Rakazo";

export function userDataPath(appDataDir: string): string {
  return path.join(appDataDir, LEGACY_USER_DATA_DIR_NAME);
}
