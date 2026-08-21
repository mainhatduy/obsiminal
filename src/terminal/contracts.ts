export interface Disposable {
  dispose(): void;
}

export interface PtyExitEvent {
  exitCode: number;
  signal?: number;
}

export interface PtyProcess {
  readonly process: string;
  kill(signal?: string): void;
  onData(listener: (data: string) => void): Disposable;
  onExit(listener: (event: PtyExitEvent) => void): Disposable;
  resize(columns: number, rows: number): void;
  write(data: string): void;
}

export interface PtySpawnOptions {
  cols: number;
  cwd: string;
  env: Record<string, string>;
  name: string;
  rows: number;
}

export type PtySpawner = (
  executable: string,
  args: string[],
  options: PtySpawnOptions,
) => PtyProcess;

export type TerminalSessionState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "running" }
  | { status: "stopped" }
  | { status: "exited"; exitCode: number; signal?: number }
  | { status: "error"; message: string };

export interface TerminalSummary {
  groupId: string;
  id: string;
  label: string;
  shellPath: string;
  state: TerminalSessionState;
}

export interface TerminalSurface {
  readonly columns: number;
  readonly rows: number;

  attach(container: HTMLElement): void;
  detach(container: HTMLElement): void;
  dispose(): void;
  fit(): void;
  focus(): void;
  onInput(listener: (data: string) => void): Disposable;
  reset(): void;
  updateTheme(): void;
  write(data: string): void;
}
