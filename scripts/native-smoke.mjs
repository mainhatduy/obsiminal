import process from "node:process";

import nodePty from "node-pty";

const shell = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "/bin/sh";
const args = [];
const marker = "VAULT_SHELL_NATIVE_SMOKE";
const command =
  process.platform === "win32" ? `echo ${marker}\r\nexit\r\n` : `printf '${marker}\\n'\nexit\n`;

try {
  await runExitSmoke();
  await runKillSmoke();
  // node-pty 1.1.0 leaves its ConPTY worker referenced after shutdown on Windows.
  // Exit explicitly once the functional and lifecycle assertions have completed.
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}

async function runExitSmoke() {
  await new Promise((resolve, reject) => {
    let output = "";
    const terminal = nodePty.spawn(shell, args, {
      cols: 80,
      cwd: process.cwd(),
      env: process.env,
      name: "xterm-256color",
      rows: 24,
      ...(process.platform === "win32" ? { useConpty: true, useConptyDll: false } : {}),
    });
    terminal.resize(100, 30);
    const timeout = setTimeout(() => {
      terminal.kill();
      reject(new Error("node-pty smoke test timed out waiting for shell output"));
    }, 15_000);
    terminal.onData((data) => {
      output += data;
    });
    terminal.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      if (!output.includes(marker)) {
        reject(new Error(`node-pty smoke test did not receive marker; exit code ${exitCode}`));
        return;
      }
      resolve(undefined);
    });
    terminal.write(command);
  });
}

async function runKillSmoke() {
  await new Promise((resolve, reject) => {
    const terminal = nodePty.spawn(shell, args, {
      cols: 80,
      cwd: process.cwd(),
      env: process.env,
      name: "xterm-256color",
      rows: 24,
      ...(process.platform === "win32" ? { useConpty: true, useConptyDll: false } : {}),
    });
    const timeout = setTimeout(() => {
      reject(new Error("node-pty smoke test timed out while killing the shell"));
    }, 15_000);
    terminal.onExit(() => {
      clearTimeout(timeout);
      resolve(undefined);
    });
    setTimeout(() => terminal.kill(), 250);
  });
}
