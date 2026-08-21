import { basename } from "node:path";

const MAX_PROCESS_NAME_LENGTH = 48;

export interface TerminalProcessIdentity {
  processName: string | null;
  shellName: string;
}

export function createTerminalLabels(terminals: TerminalProcessIdentity[]): string[] {
  const counts = new Map<string, number>();

  return terminals.map((terminal) => {
    const name = normalizeProcessName(terminal.processName) ?? terminal.shellName;
    const ordinal = (counts.get(name) ?? 0) + 1;
    counts.set(name, ordinal);
    return ordinal === 1 ? name : `${name} ${ordinal}`;
  });
}

export function normalizeProcessName(value: string | null): string | null {
  if (!value) {
    return null;
  }

  let name = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim();
  if (!name) {
    return null;
  }

  name = name.replace(/^-+/u, "");
  if (name.includes("/")) {
    name = basename(name.split(/\s/u, 1)[0]);
  }
  name = name.replace(/\.exe$/iu, "").trim();

  if (name.length > MAX_PROCESS_NAME_LENGTH) {
    name = `${name.slice(0, MAX_PROCESS_NAME_LENGTH - 1)}…`;
  }
  return name || null;
}
