import { describe, expect, it } from "vitest";

import { createShellProfiles, discoverShellProfiles } from "../src/terminal/profiles";

describe("shell profiles", () => {
  it("keeps installed shells in discovery order and removes duplicate paths", () => {
    const installed = new Set(["/opt/homebrew/bin/fish", "/bin/zsh"]);

    expect(
      createShellProfiles(
        ["/opt/homebrew/bin/fish", "/bin/zsh", "/bin/zsh", "/missing/bash"],
        (path) => installed.has(path),
      ),
    ).toEqual([
      {
        args: ["-l"],
        label: "fish",
        name: "fish",
        path: "/opt/homebrew/bin/fish",
      },
      { args: ["-l"], label: "zsh", name: "zsh", path: "/bin/zsh" },
    ]);
  });

  it("uses shell-specific login arguments and disambiguates duplicate names", () => {
    const profiles = createShellProfiles(
      [
        "/usr/local/bin/pwsh",
        "/opt/homebrew/bin/pwsh",
        "/opt/homebrew/bin/nu",
        "/opt/homebrew/bin/elvish",
      ],
      () => true,
    );

    expect(profiles.map(({ args, label }) => ({ args, label }))).toEqual([
      { args: ["-Login"], label: "pwsh (/usr/local/bin/pwsh)" },
      { args: ["-Login"], label: "pwsh (/opt/homebrew/bin/pwsh)" },
      { args: ["--login"], label: "nu" },
      { args: [], label: "elvish" },
    ]);
  });

  it("combines the current shell, /etc/shells, and PATH candidates", () => {
    const installed = new Set(["/custom/zsh", "/opt/bin/fish", "/opt/bin/nu"]);
    const profiles = discoverShellProfiles({
      env: { PATH: "/opt/bin", SHELL: "/custom/zsh" },
      isExecutable: (path) => installed.has(path),
      readShellsFile: () => "# approved shells\n/opt/bin/fish\n",
    });

    expect(profiles.map((profile) => profile.path)).toEqual([
      "/custom/zsh",
      "/opt/bin/fish",
      "/opt/bin/nu",
    ]);
  });
});
