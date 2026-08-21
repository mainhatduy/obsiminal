import { describe, expect, it } from "vitest";

import { createTerminalLabels, normalizeProcessName } from "../src/terminal/process-name";

describe("terminal process names", () => {
  it("uses the foreground process and falls back to the shell", () => {
    expect(
      createTerminalLabels([
        { processName: "codex", shellName: "zsh" },
        { processName: null, shellName: "zsh" },
        { processName: "git", shellName: "bash" },
      ]),
    ).toEqual(["codex", "zsh", "git"]);
  });

  it("numbers only duplicate names that currently exist", () => {
    expect(
      createTerminalLabels([
        { processName: "zsh", shellName: "zsh" },
        { processName: "zsh", shellName: "zsh" },
        { processName: "node", shellName: "zsh" },
      ]),
    ).toEqual(["zsh", "zsh 2", "node"]);
  });

  it("normalizes login shells and executable paths", () => {
    expect(normalizeProcessName("-zsh")).toBe("zsh");
    expect(normalizeProcessName("/opt/homebrew/bin/obsidian-cli --help")).toBe("obsidian-cli");
    expect(normalizeProcessName("  ")).toBeNull();
  });
});
