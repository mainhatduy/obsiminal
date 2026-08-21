import console from "node:console";
import { chmod } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

if (process.platform !== "win32") {
  const nodePtyRoot = path.join(process.cwd(), "node_modules", "node-pty");
  const candidates = [
    path.join(nodePtyRoot, "build", "Release", "spawn-helper"),
    path.join(nodePtyRoot, "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper"),
  ];

  let prepared = 0;
  for (const candidate of candidates) {
    try {
      await chmod(candidate, 0o755);
      prepared += 1;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  if (prepared === 0) {
    console.warn(
      `Vault Shell: no node-pty spawn-helper was found for ${process.platform}-${process.arch}.`,
    );
  }
}

function isMissingFileError(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
