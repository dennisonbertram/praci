interface MailRowLabelInput {
  sender: string;
  unread: boolean;
  unreadText: string;
  suspicious: boolean;
  suspiciousText: string;
  labelName: string;
  subject: string;
  time: string;
  summary: string;
}

export function mailRowLabel({
  sender,
  unread,
  unreadText,
  suspicious,
  suspiciousText,
  labelName,
  subject,
  time,
  summary,
}: MailRowLabelInput) {
  return [
    sender,
    unread ? unreadText : "",
    suspicious ? suspiciousText : "",
    labelName,
    subject,
    time,
    summary,
  ]
    .filter(Boolean)
    .join(", ");
}

interface GroupRowLabelInput {
  sender: string;
  unreadCount: number;
  unreadText: string;
  count: string;
  subject: string;
  time: string;
}

export function groupRowLabel({
  sender,
  unreadCount,
  unreadText,
  count,
  subject,
  time,
}: GroupRowLabelInput) {
  return [sender, unreadCount > 0 ? unreadText : "", count, subject, time]
    .filter(Boolean)
    .join(", ");
}
