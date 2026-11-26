export type ThreadCopyFeedback = "Copied" | "Couldn't copy";

export async function copyWithFeedback(
  copy: () => Promise<unknown>,
  announce: (message: ThreadCopyFeedback) => void,
): Promise<void> {
  try {
    await copy();
  } catch {
    announce("Couldn't copy");
    return;
  }
  announce("Copied");
}

export async function loadEarlierPage<T>(
  request: () => Promise<T>,
  onPage: (page: T) => void,
  onFailure: () => void,
): Promise<void> {
  let page: T;
  try {
    page = await request();
  } catch {
    onFailure();
    return;
  }
  onPage(page);
}
