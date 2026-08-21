import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { afterEach, describe, expect, it } from "vitest";

import { getRuntimeKey, prepareBundledNodePty } from "../src/terminal/pty-assets";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("bundled node-pty assets", () => {
  it("writes nested runtime files and repairs corrupt files", () => {
    const pluginDirectory = mkdtempSync(path.join(os.tmpdir(), "vault-shell-assets-"));
    temporaryDirectories.push(pluginDirectory);
    const runtimePath = `prebuilds/${process.platform}-${process.arch}/pty.node`;
    const helperPath = "worker/runtime-helper.js";
    const files = [
      { contents: Buffer.from("module-v1"), path: runtimePath },
      { contents: Buffer.from("helper-v1"), mode: 0o755, path: helperPath },
    ];
    const nativeDirectory = path.join(
      pluginDirectory,
      "prebuilds",
      `${process.platform}-${process.arch}`,
    );

    expect(prepareBundledNodePty(pluginDirectory, files)).toBe(nativeDirectory);
    expect(readFileSync(path.join(pluginDirectory, runtimePath))).toEqual(files[0].contents);
    expect(readFileSync(path.join(pluginDirectory, helperPath))).toEqual(files[1].contents);
    expect(statSync(path.join(pluginDirectory, helperPath)).mode & 0o777).toBe(0o755);

    writeFileSync(path.join(pluginDirectory, runtimePath), "corrupt");
    prepareBundledNodePty(pluginDirectory, files);

    expect(readFileSync(path.join(pluginDirectory, runtimePath))).toEqual(files[0].contents);
  });

  it("rejects paths that escape the plugin directory", () => {
    const pluginDirectory = mkdtempSync(path.join(os.tmpdir(), "vault-shell-assets-"));
    temporaryDirectories.push(pluginDirectory);

    expect(() =>
      prepareBundledNodePty(pluginDirectory, [
        { contents: Buffer.from("unsafe"), path: "../outside.node" },
      ]),
    ).toThrow("invalid bundled PTY runtime path");
  });

  it("accepts the six supported runtime targets and rejects others", () => {
    expect(getRuntimeKey("darwin", "arm64")).toBe("darwin-arm64");
    expect(getRuntimeKey("darwin", "x64")).toBe("darwin-x64");
    expect(getRuntimeKey("linux", "arm64")).toBe("linux-arm64");
    expect(getRuntimeKey("linux", "x64")).toBe("linux-x64");
    expect(getRuntimeKey("win32", "arm64")).toBe("win32-arm64");
    expect(getRuntimeKey("win32", "x64")).toBe("win32-x64");
    expect(() => getRuntimeKey("freebsd", "x64")).toThrow("does not support freebsd x64");
  });
});
