import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { basename, delimiter, dirname, join, normalize } from "node:path";

const KNOWN_SHELL_NAMES = [
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

const SYSTEM_SHELLS = ["/bin/zsh", "/bin/bash", "/bin/sh"];

export interface ShellProfile {
  args: string[];
  label: string;
  name: string;
  path: string;
}

export interface DiscoverShellProfilesOptions {
  env?: NodeJS.ProcessEnv;
  isExecutable?: (path: string) => boolean;
  readShellsFile?: () => string;
}

export function discoverShellProfiles(options: DiscoverShellProfilesOptions = {}): ShellProfile[] {
  const env = options.env ?? process.env;
  const candidates: string[] = [];
  const add = (path: string | undefined): void => {
    const value = path?.trim();
    if (value) {
      candidates.push(value);
    }
  };

  add(env.SHELL);
  add(env.COMSPEC);

  try {
    const contents = (options.readShellsFile ?? (() => readFileSync("/etc/shells", "utf8")))();
    for (const line of contents.split(/\r?\n/u)) {
      const path = line.replace(/#.*$/u, "").trim();
      if (path.startsWith("/")) {
        add(path);
      }
    }
  } catch {
    // /etc/shells is not available on every desktop platform.
  }

  for (const path of SYSTEM_SHELLS) {
    add(path);
  }

  const pathDirectories = (env.PATH ?? "")
    .split(delimiter)
    .map((path) => path.trim())
    .filter(Boolean);
  const shellDirectories = new Set([
    ...pathDirectories,
    ...(env.SHELL?.startsWith("/") ? [dirname(env.SHELL)] : []),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/bin",
    "/usr/bin",
    ...(env.HOME ? [join(env.HOME, ".local/bin"), join(env.HOME, ".nix-profile/bin")] : []),
  ]);
  for (const directory of shellDirectories) {
    for (const name of KNOWN_SHELL_NAMES) {
      add(join(directory, name));
      if (process.platform === "win32") {
        add(join(directory, `${name}.exe`));
      }
    }
  }

  return createShellProfiles(candidates, options.isExecutable ?? isExecutableFile);
}

export function createShellProfiles(
  candidates: string[],
  isExecutable: (path: string) => boolean,
): ShellProfile[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const path = normalize(candidate);
    if (seen.has(path) || !isExecutable(path)) {
      continue;
    }

    seen.add(path);
    paths.push(path);
  }

  const nameCounts = new Map<string, number>();
  for (const path of paths) {
    const name = shellName(path);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return paths.map((path) => {
    const name = shellName(path);
    return {
      args: loginArguments(name),
      label: nameCounts.get(name) === 1 ? name : `${name} (${path})`,
      name,
      path,
    };
  });
}

function isExecutableFile(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function shellName(path: string): string {
  return basename(path).replace(/\.exe$/iu, "");
}

function loginArguments(name: string): string[] {
  if (name === "elvish") {
    return [];
  }
  if (name === "pwsh") {
    return ["-Login"];
  }
  if (name === "nu") {
    return ["--login"];
  }
  return ["-l"];
}
