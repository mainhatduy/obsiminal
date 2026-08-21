import type {
  Disposable,
  PtyProcess,
  PtySpawner,
  TerminalSessionState,
  TerminalSurface,
} from "./contracts";

export interface TerminalSessionOptions {
  args: string[];
  cwd: string;
  env: Record<string, string>;
  onStateChange?: (state: TerminalSessionState) => void;
  shell: string;
  spawner: PtySpawner;
  surface: TerminalSurface;
}

export class TerminalSession {
  private disposed = false;
  private inputDisposable: Disposable;
  private processDisposables: Disposable[] = [];
  private pty: PtyProcess | null = null;
  private sessionState: TerminalSessionState = { status: "idle" };

  constructor(private readonly options: TerminalSessionOptions) {
    this.inputDisposable = options.surface.onInput((data) => this.write(data));
  }

  get state(): TerminalSessionState {
    return this.sessionState;
  }

  get isRunning(): boolean {
    return this.pty !== null && this.sessionState.status === "running";
  }

  get processName(): string | null {
    if (!this.pty) {
      return null;
    }

    try {
      return this.pty.process.trim() || null;
    } catch {
      return null;
    }
  }

  start(): boolean {
    if (this.disposed || this.pty) {
      return false;
    }

    this.setState({ status: "starting" });

    try {
      const process = this.options.spawner(this.options.shell, this.options.args, {
        cols: Math.max(this.options.surface.columns, 1),
        cwd: this.options.cwd,
        env: this.options.env,
        name: "xterm-256color",
        rows: Math.max(this.options.surface.rows, 1),
      });

      this.pty = process;
      this.processDisposables = [
        process.onData((data) => {
          if (this.pty === process) {
            this.options.surface.write(data);
          }
        }),
        process.onExit((event) => this.handleExit(process, event)),
      ];
      this.setState({ status: "running" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.surface.write(`\r\n[Vault Shell could not start: ${message}]\r\n`);
      this.setState({ status: "error", message });
      return false;
    }
  }

  attach(container: HTMLElement): void {
    this.options.surface.attach(container);
    this.options.surface.updateTheme();
  }

  detach(container: HTMLElement): void {
    this.options.surface.detach(container);
  }

  focus(): void {
    this.options.surface.focus();
  }

  resize(): void {
    this.options.surface.fit();

    if (this.pty && this.options.surface.columns > 0 && this.options.surface.rows > 0) {
      this.pty.resize(this.options.surface.columns, this.options.surface.rows);
    }
  }

  write(data: string): void {
    this.pty?.write(data);
  }

  restart(): boolean {
    if (this.disposed) {
      return false;
    }

    this.stopProcess(false);
    this.options.surface.reset();
    return this.start();
  }

  kill(): void {
    if (this.disposed) {
      return;
    }

    const stopped = this.stopProcess(true);
    if (stopped) {
      this.setState({ status: "stopped" });
    }
  }

  updateTheme(): void {
    this.options.surface.updateTheme();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.stopProcess(false);
    this.inputDisposable.dispose();
    this.options.surface.dispose();
  }

  private handleExit(process: PtyProcess, event: { exitCode: number; signal?: number }): void {
    if (this.pty !== process || this.disposed) {
      return;
    }

    this.pty = null;
    this.disposeProcessListeners();
    this.options.surface.write(`\r\n[Process exited with code ${event.exitCode}]\r\n`);
    this.setState({
      status: "exited",
      exitCode: event.exitCode,
      ...(event.signal === undefined ? {} : { signal: event.signal }),
    });
  }

  private stopProcess(announce: boolean): boolean {
    const process = this.pty;
    if (!process) {
      return false;
    }

    this.pty = null;
    this.disposeProcessListeners();
    process.kill();

    if (announce) {
      this.options.surface.write("\r\n[Terminal stopped]\r\n");
    }

    return true;
  }

  private disposeProcessListeners(): void {
    for (const disposable of this.processDisposables) {
      disposable.dispose();
    }
    this.processDisposables = [];
  }

  private setState(state: TerminalSessionState): void {
    this.sessionState = state;
    this.options.onStateChange?.(state);
  }
}
