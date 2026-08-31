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

    if (process.platform === "win32") {
      // Obsidian's Electron renderer does not support Node worker_threads (V8 Worker error).
      // node-pty on Windows uses a worker thread solely to drain ConPTY's outSocket pipe.
      // Patch ConoutConnection to connect directly without instantiating worker_threads.Worker.
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Patch Windows ConoutConnection before WindowsTerminal spawns.
      const windowsConoutConnection = require("node-pty/lib/windowsConoutConnection") as {
        ConoutConnection: unknown;
      };

      windowsConoutConnection.ConoutConnection = class InProcessConoutConnection {
        private readonly conoutPipeName: string;
        private readonly useConptyDll: boolean;
        private isDisposed = false;
        private readonly onReadyEmitter: {
          event: (listener: () => void) => { dispose: () => void };
          fire: () => void;
        };

        constructor(conoutPipeName: string, useConptyDll: boolean) {
          this.conoutPipeName = conoutPipeName;
          this.useConptyDll = useConptyDll;

          const listeners: Array<() => void> = [];
          this.onReadyEmitter = {
            event: (listener: () => void) => {
              listeners.push(listener);
              return {
                dispose: () => {
                  const index = listeners.indexOf(listener);
                  if (index !== -1) {
                    listeners.splice(index, 1);
                  }
                },
              };
            },
            fire: () => {
              for (const listener of [...listeners]) {
                listener();
              }
            },
          };

          queueMicrotask(() => {
            this.onReadyEmitter.fire();
          });
        }

        get onReady() {
          return this.onReadyEmitter.event;
        }

        connectSocket(socket: { connect: (pipeName: string) => void }): void {
          socket.connect(this.conoutPipeName);
        }

        dispose(): void {
          if (!this.useConptyDll && this.isDisposed) {
            return;
          }
          this.isDisposed = true;
        }
      };
    }

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
