import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type ITheme } from "@xterm/xterm";

import type { Disposable, TerminalSurface } from "./contracts";

const FALLBACK_FONT = "Menlo, Monaco, 'Courier New', monospace";

export class XtermSurface implements TerminalSurface {
  private readonly fitAddon = new FitAddon();
  private readonly host = document.createElement("div");
  private readonly terminal: Terminal;
  private opened = false;

  constructor() {
    this.host.className = "obsiminal-terminal-host";
    this.terminal = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      fontFamily: FALLBACK_FONT,
      fontSize: 13,
      scrollback: 5_000,
      theme: readObsidianTheme(),
    });
    this.terminal.loadAddon(this.fitAddon);
  }

  get columns(): number {
    return this.terminal.cols;
  }

  get rows(): number {
    return this.terminal.rows;
  }

  attach(container: HTMLElement): void {
    container.appendChild(this.host);

    if (!this.opened) {
      this.terminal.open(this.host);
      this.opened = true;
    }

    this.updateTheme();
  }

  detach(container: HTMLElement): void {
    if (this.host.parentElement === container) {
      this.host.remove();
    }
  }

  dispose(): void {
    this.host.remove();
    this.terminal.dispose();
  }

  fit(): void {
    if (
      !this.opened ||
      !this.host.isConnected ||
      this.host.clientWidth === 0 ||
      this.host.clientHeight === 0
    ) {
      return;
    }

    this.fitAddon.fit();
  }

  focus(): void {
    if (this.opened && this.host.isConnected) {
      this.terminal.focus();
    }
  }

  onInput(listener: (data: string) => void): Disposable {
    return this.terminal.onData(listener);
  }

  reset(): void {
    this.terminal.reset();
    this.terminal.clear();
  }

  updateTheme(): void {
    this.terminal.options.theme = readObsidianTheme();
    this.terminal.options.fontFamily = readCssVariable("--font-monospace") || FALLBACK_FONT;
  }

  write(data: string): void {
    this.terminal.write(data);
  }
}

function readObsidianTheme(): ITheme {
  return {
    background: readCssVariable("--background-primary") || "#1e1e1e",
    cursor: readCssVariable("--text-accent") || "#cccccc",
    cursorAccent: readCssVariable("--background-primary") || "#1e1e1e",
    foreground: readCssVariable("--text-normal") || "#cccccc",
    selectionBackground: readCssVariable("--text-selection") || "#264f78",
  };
}

function readCssVariable(name: string): string {
  if (!document.body) {
    return "";
  }

  return getComputedStyle(document.body).getPropertyValue(name).trim();
}
