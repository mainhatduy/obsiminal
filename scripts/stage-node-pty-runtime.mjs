import { chmodSync, cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const key = `${process.platform}-${process.arch}`;
const outputDirectory = path.join(".build", "node-pty-runtimes", key);
const nodePtyDirectory = path.join("node_modules", "node-pty");
const prebuildDirectory = path.join(outputDirectory, "prebuilds", key);

rmSync(outputDirectory, { force: true, recursive: true });
mkdirSync(prebuildDirectory, { recursive: true });

if (process.platform === "darwin") {
  copyPrebuild("pty.node");
  copyPrebuild("spawn-helper");
  chmodSync(path.join(prebuildDirectory, "spawn-helper"), 0o755);
} else if (process.platform === "linux") {
  cpSync(
    path.join(nodePtyDirectory, "build", "Release", "pty.node"),
    path.join(prebuildDirectory, "pty.node"),
  );
} else if (process.platform === "win32") {
  copyPrebuild("conpty.node");
  copyPrebuild("conpty_console_list.node");
  copyLibraryFile("conpty_console_list_agent.js");
  copyLibraryFile("utils.js");
  copyLibraryFile(path.join("worker", "conoutSocketWorker.js"));
  copyLibraryFile(path.join("shared", "conout.js"));
} else {
  throw new Error(`Unsupported node-pty runtime target: ${key}`);
}

function copyPrebuild(fileName) {
  cpSync(
    path.join(nodePtyDirectory, "prebuilds", key, fileName),
    path.join(prebuildDirectory, fileName),
  );
}

function copyLibraryFile(relativePath) {
  const destination = path.join(outputDirectory, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(path.join(nodePtyDirectory, "lib", relativePath), destination);
}
