import { describe, expect, it } from "vitest";

import { normalizeSettings } from "../src/settings-data";

describe("settings", () => {
  it("keeps valid custom shells and drops malformed entries", () => {
    expect(
      normalizeSettings({
        customShells: [
          {
            args: ["-d", "Ubuntu"],
            executable: "C:\\Windows\\System32\\wsl.exe",
            id: "wsl",
            name: "WSL",
          },
          { args: "--login", executable: "/bin/bash", id: "bad", name: "Bad" },
        ],
      }),
    ).toEqual({
      customShells: [
        {
          args: ["-d", "Ubuntu"],
          executable: "C:\\Windows\\System32\\wsl.exe",
          id: "wsl",
          name: "WSL",
        },
      ],
      defaultShellProfileId: null,
    });
  });

  it("returns defaults for missing or invalid data", () => {
    expect(normalizeSettings(null)).toEqual({
      customShells: [],
      defaultShellProfileId: null,
    });
    expect(normalizeSettings({ customShells: "invalid" })).toEqual({
      customShells: [],
      defaultShellProfileId: null,
    });
  });

  it("keeps a selected default shell profile", () => {
    expect(
      normalizeSettings({ customShells: [], defaultShellProfileId: "auto:/usr/bin/zsh" }),
    ).toEqual({
      customShells: [],
      defaultShellProfileId: "auto:/usr/bin/zsh",
    });
  });
});
