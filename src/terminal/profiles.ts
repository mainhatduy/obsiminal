import { accessSync, constants, readFileSync, statSync } from "node:fs";
import path from "node:path";

import type { CustomShellDefinition } from "../settings-data";

const UNIX_SHELL_NAMES = [
  "zsh",
  "bash",
  "fish",
  "nu",
  "pwsh",
  "xonsh",
  "elvish",
  "ksh",
  "tcsh",
  "csh",
  "dash",
  "sh",
];
const WINDOWS_SHELL_NAMES = ["cmd", "powershell", "wsl", ...UNIX_SHELL_NAMES];

export interface ShellProfile {
  args: string[];
  id: string;
  label: string;
  name: string;
  path: string;
}

export interface DiscoverShellProfilesOptions {
  customShells?: readonly CustomShellDefinition[];
  env?: NodeJS.ProcessEnv;
  isExecutable?: (path: string) => boolean;
  platform?: NodeJS.Platform;
  readShellsFile?: () => string;
}

interface CreateShellProfilesOptions {
  platform?: NodeJS.Platform;
}

export function discoverShellProfiles(options: DiscoverShellProfilesOptions = {}): ShellProfile[] {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const candidates: string[] = [];
  const add = (executable: string | undefined): void => {
    const value = executable?.trim();
    if (value) {
      candidates.push(value);
    }
  };

  add(environmentValue(env, platform, "SHELL"));
  add(environmentValue(env, platform, "COMSPEC"));

  if (platform !== "win32") {
    try {
      const contents = (options.readShellsFile ?? (() => readFileSync("/etc/shells", "utf8")))();
      for (const line of contents.split(/\r?\n/u)) {
        const executable = line.replace(/#.*$/u, "").trim();
        if (executable.startsWith("/")) {
          add(executable);
        }
      }
    } catch {
      // /etc/shells is not available on every desktop platform.
    }
  }

  const pathValue = environmentValue(env, platform, "PATH") ?? "";
  const pathDirectories = pathValue
    .split(pathApi.delimiter)
    .map((directory) => directory.trim())
    .filter(Boolean);

  if (platform === "win32") {
    addWindowsCandidates(env, pathDirectories, add, path.win32);
  } else {
    addUnixCandidates(env, platform, pathDirectories, add, path.posix);
  }

  const isExecutable =
    options.isExecutable ?? ((executable) => isExecutableFile(executable, platform));
  const automatic = createShellProfiles(candidates, isExecutable, { platform });
  const custom = createCustomShellProfiles(options.customShells ?? [], isExecutable, platform);
  return [...automatic, ...custom];
}

export function createShellProfiles(
  candidates: string[],
  isExecutable: (path: string) => boolean,
  options: CreateShellProfilesOptions = {},
): ShellProfile[] {
  const platform = options.platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const executable = pathApi.normalize(candidate);
    const key = comparisonKey(executable, platform);
    if (seen.has(key) || !isExecutable(executable)) {
      continue;
    }

    seen.add(key);
    paths.push(executable);
  }

  const nameCounts = new Map<string, number>();
  for (const executable of paths) {
    const name = shellName(executable, pathApi);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return paths.map((executable) => {
    const name = shellName(executable, pathApi);
    return {
      args: loginArguments(name, platform),
      id: `auto:${comparisonKey(executable, platform)}`,
      label: nameCounts.get(name) === 1 ? name : `${name} (${executable})`,
      name,
      path: executable,
    };
  });
}

export function isShellExecutable(
  executable: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (!executable || !(platform === "win32" ? path.win32 : path.posix).isAbsolute(executable)) {
    return false;
  }
  return isExecutableFile(executable, platform);
}

function createCustomShellProfiles(
  definitions: readonly CustomShellDefinition[],
  isExecutable: (path: string) => boolean,
  platform: NodeJS.Platform,
): ShellProfile[] {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const seenIds = new Set<string>();
  const profiles: ShellProfile[] = [];

  for (const definition of definitions) {
    const executable = pathApi.normalize(definition.executable.trim());
    if (
      !definition.id ||
      seenIds.has(definition.id) ||
      !pathApi.isAbsolute(executable) ||
      !isExecutable(executable)
    ) {
      continue;
    }
    seenIds.add(definition.id);

    const name = definition.name.trim() || shellName(executable, pathApi);
    profiles.push({
      args: [...definition.args],
      id: `custom:${definition.id}`,
      label: name,
      name,
      path: executable,
    });
  }

  return profiles;
}

function addUnixCandidates(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  pathDirectories: string[],
  add: (path: string | undefined) => void,
  pathApi: typeof path.posix,
): void {
  add("/bin/zsh");
  add("/bin/bash");
  add("/bin/sh");

  const shell = environmentValue(env, platform, "SHELL");
  const home = environmentValue(env, platform, "HOME");
  const directories = new Set([
    ...pathDirectories,
    ...(shell?.startsWith("/") ? [pathApi.dirname(shell)] : []),
    ...(platform === "darwin" ? ["/opt/homebrew/bin"] : []),
    "/usr/local/bin",
    "/bin",
    "/usr/bin",
    ...(platform === "linux" ? ["/snap/bin"] : []),
    ...(home ? [pathApi.join(home, ".local/bin"), pathApi.join(home, ".nix-profile/bin")] : []),
  ]);
  for (const directory of directories) {
    for (const name of UNIX_SHELL_NAMES) {
      add(pathApi.join(directory, name));
    }
  }
}

function addWindowsCandidates(
  env: NodeJS.ProcessEnv,
  pathDirectories: string[],
  add: (path: string | undefined) => void,
  pathApi: typeof path.win32,
): void {
  const systemRoot = environmentValue(env, "win32", "SYSTEMROOT") ?? "C:\\Windows";
  const programFiles = environmentValue(env, "win32", "PROGRAMFILES") ?? "C:\\Program Files";
  const localAppData = environmentValue(env, "win32", "LOCALAPPDATA");

  const standardExecutables = [
    pathApi.join(systemRoot, "System32", "cmd.exe"),
    pathApi.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    pathApi.join(systemRoot, "System32", "wsl.exe"),
    pathApi.join(programFiles, "PowerShell", "7", "pwsh.exe"),
    pathApi.join(programFiles, "Git", "bin", "bash.exe"),
    ...(localAppData ? [pathApi.join(localAppData, "Microsoft", "WindowsApps", "pwsh.exe")] : []),
  ];
  for (const executable of standardExecutables) {
    add(executable);
  }

  const directories = new Set([
    ...pathDirectories,
    pathApi.join("C:\\", "msys64", "usr", "bin"),
    pathApi.join("C:\\", "msys64", "mingw64", "bin"),
    pathApi.join("C:\\", "cygwin64", "bin"),
  ]);
  for (const directory of directories) {
    for (const name of WINDOWS_SHELL_NAMES) {
      add(pathApi.join(directory, `${name}.exe`));
    }
  }
}

function environmentValue(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  name: string,
): string | undefined {
  if (platform !== "win32") {
    return env[name];
  }
  const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name);
  return key ? env[key] : undefined;
}

function isExecutableFile(executable: string, platform: NodeJS.Platform): boolean {
  try {
    if (platform !== "win32") {
      accessSync(executable, constants.X_OK);
    }
    return statSync(executable).isFile();
  } catch {
    return false;
  }
}

function shellName(executable: string, pathApi: Pick<typeof path.posix, "basename">): string {
  return pathApi.basename(executable).replace(/\.exe$/iu, "");
}

function loginArguments(name: string, platform: NodeJS.Platform): string[] {
  if (platform === "win32") {
    if (name === "cmd" || name === "wsl") {
      return [];
    }
    if (name === "powershell" || name === "pwsh") {
      return ["-NoLogo"];
    }
  }
  if (name === "elvish") {
    return [];
  }
  if (name === "pwsh" || name === "powershell") {
    return ["-Login"];
  }
  if (name === "nu") {
    return ["--login"];
  }
  return ["-l"];
}

function comparisonKey(executable: string, platform: NodeJS.Platform): string {
  return platform === "win32" ? executable.toLowerCase() : executable;
}
