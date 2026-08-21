import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

declare const __NODE_PTY_RUNTIMES__: Record<string, BundledRuntimeFileDefinition[]>;

interface BundledRuntimeFileDefinition {
  contents: string;
  mode?: number;
  path: string;
}

export interface BundledRuntimeFile {
  contents: Buffer;
  mode?: number;
  path: string;
}

const SUPPORTED_RUNTIME_KEYS = new Set([
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
  "win32-arm64",
  "win32-x64",
]);

export function prepareBundledNodePty(
  pluginDirectory: string,
  files = getFilesForCurrentPlatform(),
): string {
  for (const file of files) {
    if (path.isAbsolute(file.path) || file.path.split(/[\\/]/u).includes("..")) {
      throw new Error(`invalid bundled PTY runtime path: ${file.path}`);
    }

    ensureAsset(path.join(pluginDirectory, file.path), file.contents, file.mode);
  }

  return path.join(pluginDirectory, "prebuilds", `${process.platform}-${process.arch}`);
}

export function getRuntimeKey(
  platform: NodeJS.Platform = process.platform,
  architecture: string = process.arch,
): string {
  const key = `${platform}-${architecture}`;
  if (!SUPPORTED_RUNTIME_KEYS.has(key)) {
    throw new Error(`the bundled PTY runtime does not support ${platform} ${architecture}`);
  }
  return key;
}

function getFilesForCurrentPlatform(): BundledRuntimeFile[] {
  const key = getRuntimeKey();
  assertSupportedLinuxRuntime();
  const definitions = __NODE_PTY_RUNTIMES__[key];
  if (!definitions?.length) {
    throw new Error(`the plugin bundle does not include the PTY runtime for ${key}`);
  }

  return definitions.map((file) => ({
    contents: Buffer.from(file.contents, "base64"),
    ...(file.mode === undefined ? {} : { mode: file.mode }),
    path: file.path,
  }));
}

function assertSupportedLinuxRuntime(): void {
  if (process.platform !== "linux") {
    return;
  }

  try {
    const report = process.report?.getReport() as {
      header?: { glibcVersionRuntime?: string };
    };
    if (report.header && !report.header.glibcVersionRuntime) {
      throw new Error("the bundled PTY runtime supports glibc Linux only (musl is not supported)");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("glibc Linux only")) {
      throw error;
    }
    // Some Electron builds disable diagnostic reports. Let the native loader report incompatibility.
  }
}

function ensureAsset(filePath: string, expected: Buffer, mode?: number): void {
  try {
    if (readFileSync(filePath).equals(expected)) {
      if (mode !== undefined) {
        chmodSync(filePath, mode);
      }
      return;
    }
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, expected, mode === undefined ? undefined : { mode });
    renameSync(temporaryPath, filePath);
    if (mode !== undefined) {
      chmodSync(filePath, mode);
    }
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
