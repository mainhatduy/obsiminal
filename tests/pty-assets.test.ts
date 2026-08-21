import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { afterEach, describe, expect, it } from "vitest";

import { prepareBundledNodePty } from "../src/terminal/pty-assets";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("bundled node-pty assets", () => {
  it("writes and repairs the runtime for the current architecture", () => {
    const pluginDirectory = mkdtempSync(path.join(os.tmpdir(), "vault-shell-assets-"));
    temporaryDirectories.push(pluginDirectory);
    const assets = {
      helper: Buffer.from("helper-v1"),
      module: Buffer.from("module-v1"),
    };
    const nativeDirectory = path.join(
      pluginDirectory,
      "prebuilds",
      `${process.platform}-${process.arch}`,
    );

    expect(prepareBundledNodePty(pluginDirectory, assets)).toBe(nativeDirectory);

    const helperPath = path.join(nativeDirectory, "spawn-helper");
    const modulePath = path.join(nativeDirectory, "pty.node");
    expect(readFileSync(helperPath)).toEqual(assets.helper);
    expect(readFileSync(modulePath)).toEqual(assets.module);
    expect(statSync(helperPath).mode & 0o777).toBe(0o755);

    writeFileSync(modulePath, "corrupt");
    prepareBundledNodePty(pluginDirectory, assets);

    expect(readFileSync(modulePath)).toEqual(assets.module);
  });
});
