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
    });
  });

  it("returns defaults for missing or invalid data", () => {
    expect(normalizeSettings(null)).toEqual({ customShells: [] });
    expect(normalizeSettings({ customShells: "invalid" })).toEqual({ customShells: [] });
  });
});
