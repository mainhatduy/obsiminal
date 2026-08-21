import { describe, expect, it, vi } from "vitest";

import type {
  Disposable,
  PtyExitEvent,
  PtyProcess,
  PtySpawnOptions,
  TerminalSessionState,
  TerminalSurface,
} from "../src/terminal/contracts";
import { TerminalSession } from "../src/terminal/session";

class FakePty implements PtyProcess {
  process = "zsh";
  readonly kill = vi.fn();
  readonly resize = vi.fn();
  readonly write = vi.fn();
  private dataListener: ((data: string) => void) | null = null;
  private exitListener: ((event: PtyExitEvent) => void) | null = null;

  onData(listener: (data: string) => void): Disposable {
    this.dataListener = listener;
    return {
      dispose: () => {
        this.dataListener = null;
      },
    };
  }

  onExit(listener: (event: PtyExitEvent) => void): Disposable {
    this.exitListener = listener;
    return {
      dispose: () => {
        this.exitListener = null;
      },
    };
  }

  emitData(data: string): void {
    this.dataListener?.(data);
  }

  emitExit(event: PtyExitEvent): void {
    this.exitListener?.(event);
  }
}

class FakeSurface implements TerminalSurface {
  columns = 80;
  rows = 24;
  readonly attach = vi.fn();
  readonly detach = vi.fn();
  readonly dispose = vi.fn();
  readonly fit = vi.fn();
  readonly focus = vi.fn();
  readonly reset = vi.fn();
  readonly updateTheme = vi.fn();
  readonly write = vi.fn();
  private inputListener: ((data: string) => void) | null = null;

  onInput(listener: (data: string) => void): Disposable {
    this.inputListener = listener;
    return {
      dispose: () => {
        this.inputListener = null;
      },
    };
  }

  emitInput(data: string): void {
    this.inputListener?.(data);
  }
}

function createHarness() {
  const processes: FakePty[] = [];
  const spawnOptions: PtySpawnOptions[] = [];
  const states: TerminalSessionState[] = [];
  const surface = new FakeSurface();
  const session = new TerminalSession({
    args: ["-l"],
    cwd: "/tmp/My Vault",
    env: { TERM: "xterm-256color" },
    onStateChange: (state) => states.push(state),
    shell: "/bin/zsh",
    spawner: (_executable, _args, options) => {
      const process = new FakePty();
      processes.push(process);
      spawnOptions.push(options);
      return process;
    },
    surface,
  });

  return { processes, session, spawnOptions, states, surface };
}

describe("TerminalSession", () => {
  it("starts a login shell and forwards input and output", () => {
    const { processes, session, spawnOptions, states, surface } = createHarness();

    expect(session.start()).toBe(true);
    expect(session.isRunning).toBe(true);
    expect(spawnOptions[0]).toMatchObject({
      cols: 80,
      cwd: "/tmp/My Vault",
      name: "xterm-256color",
      rows: 24,
    });
    expect(states).toEqual([{ status: "starting" }, { status: "running" }]);

    surface.emitInput("pwd\r");
    expect(processes[0]?.write).toHaveBeenCalledWith("pwd\r");

    processes[0]?.emitData("/tmp/My Vault\r\n");
    expect(surface.write).toHaveBeenCalledWith("/tmp/My Vault\r\n");
  });

  it("exposes the current foreground process name", () => {
    const { processes, session } = createHarness();
    session.start();

    expect(session.processName).toBe("zsh");
    if (processes[0]) {
      processes[0].process = "codex";
    }
    expect(session.processName).toBe("codex");

    processes[0]?.emitExit({ exitCode: 0 });
    expect(session.processName).toBeNull();
  });

  it("fits the surface before resizing the PTY", () => {
    const { processes, session, surface } = createHarness();
    session.start();
    surface.columns = 132;
    surface.rows = 40;

    session.resize();

    expect(surface.fit).toHaveBeenCalledOnce();
    expect(processes[0]?.resize).toHaveBeenCalledWith(132, 40);
  });

  it("keeps the process alive while the surface is detached", () => {
    const { processes, session, surface } = createHarness();
    const container = {} as HTMLElement;
    session.start();

    session.attach(container);
    session.detach(container);

    expect(surface.attach).toHaveBeenCalledWith(container);
    expect(surface.detach).toHaveBeenCalledWith(container);
    expect(processes[0]?.kill).not.toHaveBeenCalled();
    expect(session.isRunning).toBe(true);
  });

  it("stops a shell without reacting to a stale exit event", () => {
    const { processes, session, states, surface } = createHarness();
    session.start();
    const process = processes[0];

    session.kill();
    process?.emitExit({ exitCode: 0 });

    expect(process?.kill).toHaveBeenCalledOnce();
    expect(session.state).toEqual({ status: "stopped" });
    expect(states.at(-1)).toEqual({ status: "stopped" });
    expect(surface.write).toHaveBeenCalledWith("\r\n[Terminal stopped]\r\n");
  });

  it("reports natural shell exit and waits for an explicit restart", () => {
    const { processes, session, surface } = createHarness();
    session.start();

    processes[0]?.emitExit({ exitCode: 17, signal: 15 });

    expect(session.isRunning).toBe(false);
    expect(session.state).toEqual({ status: "exited", exitCode: 17, signal: 15 });
    expect(processes).toHaveLength(1);
    expect(surface.write).toHaveBeenCalledWith("\r\n[Process exited with code 17]\r\n");
  });

  it("kills the old process and resets the surface on restart", () => {
    const { processes, session, surface } = createHarness();
    session.start();

    expect(session.restart()).toBe(true);

    expect(processes).toHaveLength(2);
    expect(processes[0]?.kill).toHaveBeenCalledOnce();
    expect(surface.reset).toHaveBeenCalledOnce();
    expect(session.state).toEqual({ status: "running" });
  });

  it("surfaces spawn failures without throwing", () => {
    const surface = new FakeSurface();
    const session = new TerminalSession({
      args: ["-l"],
      cwd: "/tmp/vault",
      env: {},
      shell: "/missing/shell",
      spawner: () => {
        throw new Error("native module mismatch");
      },
      surface,
    });

    expect(session.start()).toBe(false);
    expect(session.state).toEqual({ status: "error", message: "native module mismatch" });
    expect(surface.write).toHaveBeenCalledWith(
      "\r\n[Vault Shell could not start: native module mismatch]\r\n",
    );
  });

  it("kills the process and disposes all terminal resources on unload", () => {
    const { processes, session, surface } = createHarness();
    session.start();

    session.dispose();
    surface.emitInput("echo orphan\r");

    expect(processes[0]?.kill).toHaveBeenCalledOnce();
    expect(processes[0]?.write).not.toHaveBeenCalled();
    expect(surface.dispose).toHaveBeenCalledOnce();
    expect(session.start()).toBe(false);
  });
});
