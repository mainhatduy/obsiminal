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
        id: "auto:/opt/homebrew/bin/fish",
        label: "fish",
        name: "fish",
        path: "/opt/homebrew/bin/fish",
      },
      {
        args: ["-l"],
        id: "auto:/bin/zsh",
        label: "zsh",
        name: "zsh",
        path: "/bin/zsh",
      },
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

  it("discovers Windows shells case-insensitively and uses Windows arguments", () => {
    const installed = new Set([
      "c:\\windows\\system32\\cmd.exe",
      "c:\\windows\\system32\\windowspowershell\\v1.0\\powershell.exe",
      "c:\\windows\\system32\\wsl.exe",
      "c:\\tools\\pwsh.exe",
    ]);
    const profiles = discoverShellProfiles({
      env: {
        ComSpec: "C:\\WINDOWS\\System32\\cmd.exe",
        Path: "C:\\Tools;C:\\WINDOWS\\System32",
        SystemRoot: "C:\\Windows",
      },
      isExecutable: (executable) => installed.has(executable.toLowerCase()),
      platform: "win32",
    });

    expect(profiles.map(({ args, name }) => ({ args, name }))).toEqual([
      { args: [], name: "cmd" },
      { args: ["-NoLogo"], name: "powershell" },
      { args: [], name: "wsl" },
      { args: ["-NoLogo"], name: "pwsh" },
    ]);
  });

  it("keeps custom profiles with the same executable and different arguments", () => {
    const profiles = discoverShellProfiles({
      customShells: [
        {
          args: ["-d", "Ubuntu"],
          executable: "C:\\Windows\\System32\\wsl.exe",
          id: "ubuntu",
          name: "Ubuntu",
        },
        {
          args: ["-d", "Debian"],
          executable: "C:\\Windows\\System32\\wsl.exe",
          id: "debian",
          name: "Debian",
        },
        { args: [], executable: "relative.exe", id: "invalid", name: "Invalid" },
      ],
      env: {},
      isExecutable: (executable) => executable.toLowerCase() === "c:\\windows\\system32\\wsl.exe",
      platform: "win32",
    });

    expect(profiles.filter((profile) => profile.id.startsWith("custom:"))).toEqual([
      {
        args: ["-d", "Ubuntu"],
        id: "custom:ubuntu",
        label: "Ubuntu",
        name: "Ubuntu",
        path: "C:\\Windows\\System32\\wsl.exe",
      },
      {
        args: ["-d", "Debian"],
        id: "custom:debian",
        label: "Debian",
        name: "Debian",
        path: "C:\\Windows\\System32\\wsl.exe",
      },
    ]);
  });
});
