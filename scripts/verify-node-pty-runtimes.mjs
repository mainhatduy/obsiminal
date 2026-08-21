import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const runtimeRoot = path.join(".build", "node-pty-runtimes");
const targets = [
  ["darwin", "arm64"],
  ["darwin", "x64"],
  ["linux", "arm64"],
  ["linux", "x64"],
  ["win32", "arm64"],
  ["win32", "x64"],
];

for (const [platform, architecture] of targets) {
  const key = `${platform}-${architecture}`;
  const runtimeDirectory = path.join(runtimeRoot, key);
  const nativeDirectory = path.join(runtimeDirectory, "prebuilds", key);
  const requiredFiles =
    platform === "darwin"
      ? [path.join(nativeDirectory, "pty.node"), path.join(nativeDirectory, "spawn-helper")]
      : platform === "linux"
        ? [path.join(nativeDirectory, "pty.node")]
        : [
            path.join(nativeDirectory, "conpty.node"),
            path.join(nativeDirectory, "conpty_console_list.node"),
            path.join(runtimeDirectory, "conpty_console_list_agent.js"),
            path.join(runtimeDirectory, "utils.js"),
            path.join(runtimeDirectory, "worker", "conoutSocketWorker.js"),
            path.join(runtimeDirectory, "shared", "conout.js"),
          ];

  for (const file of requiredFiles) {
    if (!existsSync(file) || statSync(file).size === 0) {
      throw new Error(`Missing or empty runtime file: ${file}`);
    }
  }

  const nativeFile = path.join(nativeDirectory, platform === "win32" ? "conpty.node" : "pty.node");
  verifyArchitecture(readFileSync(nativeFile), platform, architecture, nativeFile);
}

function verifyArchitecture(buffer, platform, architecture, file) {
  let actual;
  if (platform === "darwin") {
    if (buffer.readUInt32LE(0) !== 0xfeedfacf) {
      throw new Error(`Expected a 64-bit Mach-O binary: ${file}`);
    }
    const machine = buffer.readUInt32LE(4);
    actual = machine === 0x0100000c ? "arm64" : machine === 0x01000007 ? "x64" : undefined;
  } else if (platform === "linux") {
    if (buffer.subarray(0, 4).toString("hex") !== "7f454c46") {
      throw new Error(`Expected an ELF binary: ${file}`);
    }
    const machine = buffer.readUInt16LE(18);
    actual = machine === 0xb7 ? "arm64" : machine === 0x3e ? "x64" : undefined;
  } else {
    const peOffset = buffer.readUInt32LE(0x3c);
    if (buffer.subarray(peOffset, peOffset + 4).toString("ascii") !== "PE\0\0") {
      throw new Error(`Expected a PE binary: ${file}`);
    }
    const machine = buffer.readUInt16LE(peOffset + 4);
    actual = machine === 0xaa64 ? "arm64" : machine === 0x8664 ? "x64" : undefined;
  }

  if (!actual) {
    throw new Error(`Unsupported runtime architecture in ${file}`);
  }
  if (actual !== architecture) {
    throw new Error(
      `Runtime architecture mismatch for ${file}: expected ${architecture}, got ${actual}`,
    );
  }
}
