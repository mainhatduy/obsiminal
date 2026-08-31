import { describe, expect, it, vi } from "vitest";

import { createNodePtySpawner } from "../src/terminal/pty";

describe("createNodePtySpawner", () => {
  it("creates a spawner that configures native module loading and patches Windows ConoutConnection", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load windowsConoutConnection to check patched class.
    const windowsConoutConnection = require("node-pty/lib/windowsConoutConnection") as {
      ConoutConnection: new (
        pipeName: string,
        useConptyDll: boolean,
      ) => {
        onReady: (listener: () => void) => { dispose: () => void };
        connectSocket: (socket: { connect: (pipe: string) => void }) => void;
        dispose: () => void;
      };
    };

    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    try {
      // Mock node-pty spawn so we don't actually spawn a process in unit tests
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Mock node-pty spawn in unit tests.
      const nodePty = require("node-pty") as {
        spawn: (executable: string, args: string[], options: unknown) => unknown;
      };

      const mockSpawn = vi.spyOn(nodePty, "spawn").mockReturnValue({
        process: "powershell.exe",
        kill: vi.fn(),
        onData: vi.fn(),
        onExit: vi.fn(),
        resize: vi.fn(),
        write: vi.fn(),
      });

      const spawner = createNodePtySpawner("/mock/native/dir");
      const ptyProcess = spawner("powershell.exe", [], {
        cols: 80,
        cwd: "C:\\mock\\cwd",
        env: {},
        name: "xterm-256color",
        rows: 24,
      });

      expect(ptyProcess.process).toBe("powershell.exe");
      expect(mockSpawn).toHaveBeenCalledWith(
        "powershell.exe",
        [],
        expect.objectContaining({
          cols: 80,
          rows: 24,
          useConpty: true,
          useConptyDll: false,
        }),
      );

      // Verify that ConoutConnection was patched to the in-process implementation
      const ConnectionClass = windowsConoutConnection.ConoutConnection;
      expect(ConnectionClass.name).toBe("InProcessConoutConnection");

      const connection = new ConnectionClass("mock-conout-pipe", false);
      const readyListener = vi.fn();
      connection.onReady(readyListener);

      // Wait for microtask to fire onReady
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(readyListener).toHaveBeenCalledTimes(1);

      const fakeSocket = { connect: vi.fn() };
      connection.connectSocket(fakeSocket);
      expect(fakeSocket.connect).toHaveBeenCalledWith("mock-conout-pipe");

      expect(() => connection.dispose()).not.toThrow();

      mockSpawn.mockRestore();
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });
});
