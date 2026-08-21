import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

declare const __NODE_PTY_DARWIN_ARM64_HELPER__: string;
declare const __NODE_PTY_DARWIN_ARM64_MODULE__: string;
declare const __NODE_PTY_DARWIN_X64_HELPER__: string;
declare const __NODE_PTY_DARWIN_X64_MODULE__: string;

export interface NodePtyAssets {
  helper: Buffer;
  module: Buffer;
}

export function prepareBundledNodePty(
  pluginDirectory: string,
  assets = getAssetsForCurrentPlatform(),
): string {
  const nativeDirectory = path.join(
    pluginDirectory,
    "prebuilds",
    `${process.platform}-${process.arch}`,
  );

  mkdirSync(nativeDirectory, { recursive: true });
  ensureAsset(path.join(nativeDirectory, "pty.node"), assets.module, 0o644);
  ensureAsset(path.join(nativeDirectory, "spawn-helper"), assets.helper, 0o755);
  return nativeDirectory;
}

function getAssetsForCurrentPlatform(): NodePtyAssets {
  if (process.platform !== "darwin") {
    throw new Error("the bundled PTY runtime currently supports macOS only");
  }

  if (process.arch === "arm64") {
    return {
      helper: Buffer.from(__NODE_PTY_DARWIN_ARM64_HELPER__, "base64"),
      module: Buffer.from(__NODE_PTY_DARWIN_ARM64_MODULE__, "base64"),
    };
  }

  if (process.arch === "x64") {
    return {
      helper: Buffer.from(__NODE_PTY_DARWIN_X64_HELPER__, "base64"),
      module: Buffer.from(__NODE_PTY_DARWIN_X64_MODULE__, "base64"),
    };
  }

  throw new Error(`the bundled PTY runtime does not support macOS ${process.arch}`);
}

function ensureAsset(filePath: string, expected: Buffer, mode: number): void {
  try {
    if (readFileSync(filePath).equals(expected)) {
      chmodSync(filePath, mode);
      return;
    }
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, expected, { mode });
    renameSync(temporaryPath, filePath);
    chmodSync(filePath, mode);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
