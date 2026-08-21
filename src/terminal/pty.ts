import type {
  IPty,
  IWindowsPtyForkOptions,
  IPtyForkOptions,
  spawn as nodePtySpawn,
} from "node-pty";

import type { PtyProcess, PtySpawner } from "./contracts";

interface NodePtyModule {
  spawn: typeof nodePtySpawn;
}

export function createNodePtySpawner(): PtySpawner {
  return (executable, args, options): PtyProcess => {
    // Loading the bundled module lazily lets the plugin provision its native
    // runtime first and report startup errors inside the terminal surface.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Keep native module initialization lazy so plugin startup can recover from load errors.
    const nodePty = require("node-pty") as NodePtyModule;
    const spawnOptions: IPtyForkOptions | IWindowsPtyForkOptions = {
      cols: options.cols,
      cwd: options.cwd,
      env: options.env,
      name: options.name,
      rows: options.rows,
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
