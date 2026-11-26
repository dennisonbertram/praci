export const likeLiteral = (text: string) => text.replace(/[\\%_]/g, "\\$&");
