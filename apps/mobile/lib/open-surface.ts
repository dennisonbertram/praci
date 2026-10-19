let openSurface: string | null = null;

/** The page screen on top, so a notification for it is not shown as a banner. */
export function setOpenSurface(surface: string | null): void {
  openSurface = surface;
}

export function isOpenSurface(surface: unknown): boolean {
  return typeof surface === "string" && surface === openSurface;
}
