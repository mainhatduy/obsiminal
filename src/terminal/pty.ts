import type {
  IPty,
  IWindowsPtyForkOptions,
  IPtyForkOptions,
  spawn as nodePtySpawn,
} from "node-pty";
import path from "node:path";

import type { PtyProcess, PtySpawner } from "./contracts";

interface NodePtyModule {
  spawn: typeof nodePtySpawn;
}

interface NodePtyUtilsModule {
  loadNativeModule(name: string): { dir: string; module: unknown };
}

export function createNodePtySpawner(nativeDirectory: string): PtySpawner {
  return (executable, args, options): PtyProcess => {
    // Obsidian's Electron renderer resolves dynamic relative requires from
    // renderer_init instead of main.js. Override node-pty's native loader with
    // an absolute path before initializing the bundled module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Patch node-pty before its native module is initialized.
    const nodePtyUtils = require("node-pty/lib/utils") as NodePtyUtilsModule;
    nodePtyUtils.loadNativeModule = (name) => {
      const modulePath = path.join(nativeDirectory, `${name}.node`);
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Native addons must be loaded from their absolute runtime path in Electron.
      return { dir: nativeDirectory, module: require(modulePath) as unknown };
    };

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Keep native module initialization lazy so errors can be shown in the terminal surface.
    const nodePty = require("node-pty") as NodePtyModule;
    const spawnOptions: IPtyForkOptions | IWindowsPtyForkOptions = {
      cols: options.cols,
      cwd: options.cwd,
      env: options.env,
      name: options.name,
      rows: options.rows,
      ...(process.platform === "win32" ? { useConpty: true, useConptyDll: false } : {}),
    };

    return adaptPty(nodePty.spawn(executable, args, spawnOptions));
  };
}

function adaptPty(pty: IPty): PtyProcess {
  return {
    get process() {
      return pty.process;
    },
    kill: (signal) => pty.kill(signal),
    onData: (listener) => pty.onData(listener),
    onExit: (listener) => pty.onExit(listener),
    resize: (columns, rows) => pty.resize(columns, rows),
    write: (data) => pty.write(data),
  };
}
