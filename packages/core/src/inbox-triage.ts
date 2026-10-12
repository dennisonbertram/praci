// Pure triage logic for the inbox: prompt, response parser, to-do candidate selection, and the
// to-do sync plan. Stubs for now; the tests in inbox-triage.test.ts define the behavior.

export const TRIAGE_VERSION = 1;
export const TRIAGE_BATCH_SIZE = 20;
export const MAX_TRIAGE_PER_RUN = 100;
export const MAX_OPEN_TODOS = 5;

export type TriagePriority = "critical" | "important" | "normal" | "low";
export type TriageCategory = "reply" | "action" | "fyi" | "bulk" | "suspicious";

export interface TriageInputMessage {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  receivedAt: string;
  addressedToMe: boolean;
  threadLength: number;
}

export interface TriageItem {
  id: string;
  needsReply: boolean;
  priority: TriagePriority;
  category: TriageCategory;
  reason: string;
  todo: string | null;
  due: string | null;
}

export interface TodoCandidateMessage {
  id: string;
  connectionId: string;
  priority: string | null;
  category: string | null;
  todoText: string | null;
  reason: string | null;
  dueOn: Date | null;
  receivedAt: Date;
  alreadyHandled: boolean;
}

export interface ExistingTodo {
  id: string;
  messageId: string | null;
  doneAt: Date | null;
  touchedAt: Date | null;
}

export interface TodoInsert {
  connectionId: string;
  messageId: string;
  text: string;
  detail: string | null;
  dueOn: Date | null;
}

export interface ThreadMessage {
  id: string;
  connectionId: string;
  threadId: string;
  receivedAt: Date;
  fromSelf: boolean;
}

export const TRIAGE_INSTRUCTIONS = "";

export function buildTriagePrompt(_messages: TriageInputMessage[]): string {
  return "";
}

export function parseTriageResponse(_raw: string, _inputIds: string[]): TriageItem[] {
  return [];
}

export function selectTodoCandidates(
  _messages: TodoCandidateMessage[],
  _limit = MAX_OPEN_TODOS,
): TodoCandidateMessage[] {
  return [];
}

export function planTodoSync(
  _existing: ExistingTodo[],
  _candidates: TodoCandidateMessage[],
  _limit = MAX_OPEN_TODOS,
): { deleteIds: string[]; inserts: TodoInsert[] } {
  return { deleteIds: [], inserts: [] };
}

export function deriveAlreadyHandled(_messages: ThreadMessage[]): Set<string> {
  return new Set();
}
