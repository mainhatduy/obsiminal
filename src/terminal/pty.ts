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

export function createNodePtySpawner(modulePath = "node-pty"): PtySpawner {
  return (executable, args, options): PtyProcess => {
    // Keep the native dependency outside the bundle. Loading it lazily lets the
    // plugin show a useful error instead of crashing during plugin startup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePty = require(modulePath) as NodePtyModule;
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
