/** A line the shell prints before it reads a secret (sudo, ssh, gpg). Never record what follows. */
const SECRET_PROMPT = /pass(word|phrase|code)|\bpin\b|secret|token|\botp\b|verification code/i;

/**
 * Collects what the user types into the shell and reports each submitted line. Editing keys
 * other than Backspace and Ctrl-C make the line unknowable, so they drop it. `promptLine` returns
 * the text on screen at the cursor; a secret prompt there means the line is not a command.
 */
export function createCommandBuffer(
  onCommand: (command: string) => void,
  promptLine: () => string = () => "",
): (data: string) => void {
  let line = "";
  return (data) => {
    if (data.startsWith("\x1b")) {
      line = "";
      return;
    }
    for (const char of data) {
      if (char === "\r" || char === "\n") {
        const command = line.trim();
        const hidden = SECRET_PROMPT.test(promptLine());
        line = "";
        if (command && !hidden) onCommand(command);
      } else if (char === "\x7f" || char === "\b") {
        line = Array.from(line).slice(0, -1).join("");
      } else if (char === "\x03" || char === "\x15") {
        line = "";
      } else if (char >= " ") {
        line += char;
      }
    }
  };
}
