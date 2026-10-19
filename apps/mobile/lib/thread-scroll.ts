import type { ThreadScrollState } from "@rakazo/core";

export type { ThreadScrollState } from "@rakazo/core";

export type ThreadScrollAction = "jump" | "smooth" | null;

export class ThreadScrollBehavior {
  private threadKey: string | null = null;
  private laidOut = false;
  private contentReady = false;
  private latestMessageId: string | null = null;
  private currentState: ThreadScrollState = { detached: false, unread: false, newCount: 0 };

  openThread(threadKey: string): void {
    if (this.threadKey === threadKey) return;
    this.threadKey = threadKey;
    this.laidOut = false;
    this.contentReady = false;
    this.latestMessageId = null;
    this.currentState = { detached: false, unread: false, newCount: 0 };
  }

  onLayout(): ThreadScrollAction {
    this.laidOut = true;
    return this.contentReady && !this.currentState.detached ? "jump" : null;
  }

  /** `incoming` is how many stored messages from the other party the change added. */
  onContentChanged(
    blocked: boolean,
    latestMessageId: string | null,
    incoming = 0,
  ): ThreadScrollAction {
    if (blocked) return null;
    this.contentReady = true;
    if (latestMessageId === null || latestMessageId === this.latestMessageId) return null;
    const initial = this.latestMessageId === null;
    this.latestMessageId = latestMessageId;
    if (initial) return this.laidOut ? "jump" : null;
    if (this.currentState.detached) {
      // A live progress row changes the latest id without adding a message, so it adds no count.
      this.currentState = {
        detached: true,
        unread: this.currentState.unread || incoming > 0,
        newCount: this.currentState.newCount + incoming,
      };
      return null;
    }
    return "smooth";
  }

  onUserScroll(distanceFromEnd: number): ThreadScrollState {
    const detached = distanceFromEnd > 80;
    this.currentState = {
      detached,
      unread: detached ? this.currentState.unread : false,
      newCount: detached ? this.currentState.newCount : 0,
    };
    return this.state();
  }

  jumpToLatest(): ThreadScrollAction {
    this.currentState = { detached: false, unread: false, newCount: 0 };
    return "smooth";
  }

  state(): ThreadScrollState {
    return { ...this.currentState };
  }
}
