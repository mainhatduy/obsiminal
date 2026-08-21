import { FileSystemAdapter, Notice, Platform, Plugin } from "obsidian";

import type { TerminalSessionState, TerminalSummary } from "./terminal/contracts";
import { createNodePtySpawner } from "./terminal/pty";
import { prepareBundledNodePty } from "./terminal/pty-assets";
import { discoverShellProfiles, type ShellProfile } from "./terminal/profiles";
import { createTerminalLabels } from "./terminal/process-name";
import { TerminalSession } from "./terminal/session";
import { selectSingleton } from "./terminal/singleton";
import { XtermSurface } from "./terminal/surface";
import { TERMINAL_VIEW_TYPE, TerminalView } from "./terminal/view";

interface ManagedTerminal {
  groupId: string;
  id: string;
  label: string;
  profile: ShellProfile;
  session: TerminalSession;
}

export default class VaultShellPlugin extends Plugin {
  private activeTerminalId: string | null = null;
  private attachedContainer: HTMLElement | null = null;
  private readonly attachedPanes = new Map<string, HTMLElement>();
  private attachedView: TerminalView | null = null;
  private nextTerminalId = 1;
  private shellProfiles: ShellProfile[] = [];
  private readonly terminals: ManagedTerminal[] = [];

  async onload(): Promise<void> {
    this.shellProfiles = discoverShellProfiles();

    this.registerView(TERMINAL_VIEW_TYPE, (leaf) => new TerminalView(leaf, this));

    this.addRibbonIcon("terminal", "Open or focus terminal", () => {
      void this.openOrFocusTerminal();
    });

    this.addCommand({
      id: "open-or-focus-terminal",
      name: "Open or focus terminal",
      callback: () => {
        void this.openOrFocusTerminal();
      },
    });

    this.addCommand({
      id: "new-terminal",
      name: "New terminal",
      callback: () => {
        const terminalCount = this.terminals.length;
        void this.openOrFocusTerminal().then(() => {
          if (this.terminals.length === terminalCount) {
            this.createTerminal();
          }
        });
      },
    });

    this.addCommand({
      id: "split-terminal",
      name: "Split terminal",
      callback: () => {
        void this.openOrFocusTerminal().then(() => this.splitTerminal());
      },
    });

    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        for (const terminal of this.terminals) {
          terminal.session.updateTheme();
        }
      }),
    );
    this.registerInterval(window.setInterval(() => this.refreshTerminalLabels(), 750));

    this.app.workspace.onLayoutReady(() => this.removeDuplicateTerminalLeaves());
  }

  onunload(): void {
    for (const terminal of this.terminals) {
      terminal.session.dispose();
    }
    this.terminals.length = 0;
    this.activeTerminalId = null;
    this.attachedPanes.clear();
    this.attachedContainer = null;
    this.attachedView = null;
  }

  async attachView(view: TerminalView, container: HTMLElement): Promise<void> {
    try {
      this.attachedView = view;
      this.attachedContainer = container;

      if (this.terminals.length === 0) {
        this.createTerminal();
        return;
      }

      const active = this.getActiveTerminal() ?? this.terminals[0];
      this.activeTerminalId = active.id;
      this.renderActiveGroup();
      this.refreshView();
    } catch (error) {
      this.showError(error);
    }
  }

  detachView(view: TerminalView, container: HTMLElement): void {
    if (this.attachedView !== view || this.attachedContainer !== container) {
      return;
    }

    this.detachAttachedTerminals();
    this.attachedView = null;
    this.attachedContainer = null;
  }

  getShellProfiles(): readonly ShellProfile[] {
    this.shellProfiles = discoverShellProfiles();
    return this.shellProfiles;
  }

  createTerminal(shellPath?: string, groupId?: string): void {
    try {
      this.shellProfiles = discoverShellProfiles();
      const profile = shellPath
        ? this.shellProfiles.find((candidate) => candidate.path === shellPath)
        : this.shellProfiles[0];
      if (!profile) {
        throw new Error("no supported shell executable was found on this machine");
      }

      const id = `terminal-${this.nextTerminalId}`;
      const session = this.createSession(id, profile);

      this.nextTerminalId += 1;
      const terminal: ManagedTerminal = {
        groupId: groupId ?? id,
        id,
        label: profile.name,
        profile,
        session,
      };

      let groupEndIndex = this.terminals.length;
      if (groupId) {
        for (const [index, candidate] of this.terminals.entries()) {
          if (candidate.groupId === groupId) {
            groupEndIndex = index + 1;
          }
        }
      }
      this.terminals.splice(groupEndIndex, 0, terminal);
      this.refreshTerminalLabels();
      this.activeTerminalId = id;
      this.renderActiveGroup();
      terminal.session.start();
      this.refreshView();
    } catch (error) {
      this.showError(error);
    }
  }

  splitTerminal(): void {
    const active = this.getActiveTerminal();
    if (!active) {
      this.createTerminal();
      return;
    }

    this.createTerminal(active.profile.path, active.groupId);
  }

  selectTerminal(id: string): void {
    const next = this.terminals.find((terminal) => terminal.id === id);
    if (!next) {
      return;
    }

    const previous = this.getActiveTerminal();
    if (previous?.id === id) {
      next.session.focus();
      return;
    }

    this.activeTerminalId = id;
    if (previous?.groupId === next.groupId) {
      this.attachedView?.setActivePane(id);
    } else {
      this.renderActiveGroup();
    }
    this.attachedView?.updateState(next.session.state);
    this.refreshView();
    next.session.focus();
  }

  closeTerminal(id: string): void {
    const index = this.terminals.findIndex((terminal) => terminal.id === id);
    if (index < 0) {
      return;
    }

    const terminal = this.terminals[index];
    const activeBeforeClose = this.getActiveTerminal();
    const wasVisible = terminal.groupId === activeBeforeClose?.groupId;
    const attachedPane = this.attachedPanes.get(id);
    if (attachedPane) {
      terminal.session.detach(attachedPane);
      this.attachedPanes.delete(id);
    }

    this.terminals.splice(index, 1);
    this.refreshTerminalLabels();
    const wasActive = terminal.id === this.activeTerminalId;
    terminal.session.dispose();

    if (wasActive) {
      const nextInGroup =
        this.terminals.find((candidate) => candidate.groupId === terminal.groupId) ?? null;
      const next = nextInGroup ?? this.terminals[index] ?? this.terminals[index - 1] ?? null;
      this.activeTerminalId = next?.id ?? null;
      if (next) {
        this.attachedView?.updateState(next.session.state);
      } else {
        this.attachedView?.showEmptyState();
      }
    }

    if (wasVisible) {
      this.renderActiveGroup();
    }
    this.refreshView();
  }

  focusTerminal(): void {
    this.getActiveTerminal()?.session.focus();
  }

  resizeTerminal(): void {
    for (const id of this.attachedPanes.keys()) {
      this.terminals.find((terminal) => terminal.id === id)?.session.resize();
    }
  }

  private createSession(id: string, profile: ShellProfile): TerminalSession {
    if (!Platform.isMacOS) {
      throw new Error("the current release supports macOS only");
    }

    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("the current vault is not backed by a local filesystem");
    }

    const pluginDirectory = adapter.getFullPath(
      `${this.app.vault.configDir}/plugins/${this.manifest.id}`,
    );
    prepareBundledNodePty(pluginDirectory);
    return new TerminalSession({
      args: profile.args,
      cwd: adapter.getBasePath(),
      env: createShellEnvironment(process.env),
      onStateChange: (state) => this.handleSessionStateChange(id, state),
      shell: profile.path,
      spawner: createNodePtySpawner(),
      surface: new XtermSurface(),
    });
  }

  private getActiveTerminal(): ManagedTerminal | null {
    return this.terminals.find((terminal) => terminal.id === this.activeTerminalId) ?? null;
  }

  private getTerminalSummaries(): TerminalSummary[] {
    return this.terminals.map((terminal) => ({
      groupId: terminal.groupId,
      id: terminal.id,
      label: terminal.label,
      shellPath: terminal.profile.path,
      state: terminal.session.state,
    }));
  }

  private handleSessionStateChange(id: string, state: TerminalSessionState): void {
    this.refreshTerminalLabels();
    if (id === this.activeTerminalId) {
      this.attachedView?.updateState(state);
    }
    this.refreshView();

    if (state.status === "error") {
      const terminal = this.terminals.find((candidate) => candidate.id === id);
      new Notice(
        `Vault Shell could not start ${terminal?.label ?? "the terminal"}: ${state.message}`,
      );
    }
  }

  private refreshView(): void {
    this.attachedView?.renderTerminalTabs(this.getTerminalSummaries(), this.activeTerminalId);
  }

  private refreshTerminalLabels(): void {
    const labels = createTerminalLabels(
      this.terminals.map((terminal) => ({
        processName: terminal.session.processName,
        shellName: terminal.profile.name,
      })),
    );
    let changed = false;
    for (const [index, terminal] of this.terminals.entries()) {
      const label = labels[index];
      if (label && terminal.label !== label) {
        terminal.label = label;
        changed = true;
      }
    }

    if (changed) {
      this.refreshView();
    }
  }

  private renderActiveGroup(): void {
    this.detachAttachedTerminals();
    const view = this.attachedView;
    if (!view) {
      return;
    }

    const active = this.getActiveTerminal();
    if (!active) {
      view.renderTerminalPanes([], null);
      view.showEmptyState();
      return;
    }

    const summaries = this.getTerminalSummaries().filter(
      (terminal) => terminal.groupId === active.groupId,
    );
    const panes = view.renderTerminalPanes(summaries, active.id);
    for (const [id, pane] of panes) {
      const terminal = this.terminals.find((candidate) => candidate.id === id);
      if (!terminal) {
        continue;
      }
      terminal.session.attach(pane);
      this.attachedPanes.set(id, pane);
    }
    view.updateState(active.session.state);
    this.resizeAndFocusAttached();
  }

  private detachAttachedTerminals(): void {
    for (const [id, pane] of this.attachedPanes) {
      this.terminals.find((terminal) => terminal.id === id)?.session.detach(pane);
    }
    this.attachedPanes.clear();
  }

  private resizeAndFocusAttached(): void {
    if (!this.attachedContainer) {
      return;
    }

    window.requestAnimationFrame(() => {
      this.resizeTerminal();
      this.getActiveTerminal()?.session.focus();
    });
  }

  private showError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.attachedView?.showError(message);
    new Notice(`Vault Shell: ${message}`);
  }

  private async openOrFocusTerminal(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE)[0];

    if (!leaf) {
      leaf = this.app.workspace.getLeaf("split");
      await leaf.setViewState({
        type: TERMINAL_VIEW_TYPE,
        active: true,
      });
    }

    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof TerminalView) {
      leaf.view.focusTerminal();
    }
  }

  private removeDuplicateTerminalLeaves(): void {
    const leaves = this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);
    const attachedLeaf = this.attachedView?.leaf;
    const { duplicates } = selectSingleton(leaves, attachedLeaf ?? null);

    for (const leaf of duplicates) {
      leaf.detach();
    }
  }
}

function createShellEnvironment(source: NodeJS.ProcessEnv): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  env.TERM = "xterm-256color";
  env.COLORTERM = "truecolor";
  return env;
}
