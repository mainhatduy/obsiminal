import { ItemView, Menu, setIcon, type WorkspaceLeaf } from "obsidian";

import type VaultShellPlugin from "../main";
import type { TerminalSessionState, TerminalSummary } from "./contracts";

export const TERMINAL_VIEW_TYPE = "obsiminal-terminal";

export class TerminalView extends ItemView {
  private resizeObserver: ResizeObserver | null = null;
  private statusElement: HTMLElement | null = null;
  private tabsElement: HTMLElement | null = null;
  private terminalContainer: HTMLElement | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: VaultShellPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return TERMINAL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Terminal";
  }

  getIcon(): string {
    return "terminal";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("obsiminal-view");

    this.statusElement = this.contentEl.createDiv({ cls: "obsiminal-status is-hidden" });
    const workspace = this.contentEl.createDiv({ cls: "obsiminal-terminal-workspace" });
    this.terminalContainer = workspace.createDiv({ cls: "obsiminal-terminal-container" });
    const managerDivider = workspace.createDiv({
      cls: "obsiminal-manager-divider",
      attr: {
        role: "separator",
        "aria-label": "Resize terminal manager",
        "aria-orientation": "vertical",
        tabindex: "0",
      },
    });
    const manager = workspace.createDiv({
      cls: "obsiminal-terminal-manager",
      attr: { "aria-label": "Terminal manager" },
    });
    this.enableManagerResize(managerDivider, manager, workspace);
    const toolbar = manager.createDiv({ cls: "obsiminal-toolbar" });
    const actions = toolbar.createDiv({ cls: "obsiminal-toolbar-actions" });
    const splitTerminalButton = actions.createEl("button", {
      cls: "obsiminal-icon-button obsiminal-split-terminal",
      attr: { "aria-label": "Split terminal", title: "Split terminal", type: "button" },
    });
    setIcon(splitTerminalButton, "columns-2");
    this.registerDomEvent(splitTerminalButton, "click", () => this.plugin.splitTerminal());

    const createControl = actions.createDiv({ cls: "obsiminal-create-control" });
    const newTerminalButton = createControl.createEl("button", {
      cls: "obsiminal-icon-button obsiminal-new-terminal",
      attr: { "aria-label": "New terminal", title: "New terminal", type: "button" },
    });
    setIcon(newTerminalButton, "plus");
    this.registerDomEvent(newTerminalButton, "click", () => this.plugin.createTerminal());

    const profileButton = createControl.createEl("button", {
      cls: "obsiminal-icon-button obsiminal-profile-menu",
      attr: {
        "aria-label": "Select shell profile",
        title: "Select shell profile",
        type: "button",
      },
    });
    setIcon(profileButton, "chevron-down");
    this.registerDomEvent(profileButton, "click", (event) => this.showProfileMenu(event));

    this.tabsElement = manager.createDiv({
      cls: "obsiminal-terminal-tabs",
      attr: {
        role: "tablist",
        "aria-label": "Terminal sessions",
        "aria-orientation": "vertical",
      },
    });

    this.resizeObserver = new ResizeObserver(() => this.plugin.resizeTerminal());
    this.resizeObserver.observe(this.terminalContainer);

    await this.plugin.attachView(this, this.terminalContainer);
  }

  async onClose(): Promise<void> {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.terminalContainer) {
      this.plugin.detachView(this, this.terminalContainer);
    }

    this.statusElement = null;
    this.tabsElement = null;
    this.terminalContainer = null;
  }

  focusTerminal(): void {
    window.requestAnimationFrame(() => this.plugin.focusTerminal());
  }

  renderTerminalTabs(terminals: TerminalSummary[], activeId: string | null): void {
    if (!this.tabsElement) {
      return;
    }

    this.tabsElement.empty();
    const groups = new Map<string, TerminalSummary[]>();
    for (const terminal of terminals) {
      const group = groups.get(terminal.groupId) ?? [];
      group.push(terminal);
      groups.set(terminal.groupId, group);
    }

    for (const group of groups.values()) {
      const groupElement = this.tabsElement.createDiv({
        cls: `obsiminal-terminal-group${group.length > 1 ? " is-split" : ""}`,
        attr: { role: "group" },
      });

      for (const terminal of group) {
        const tab = groupElement.createDiv({
          cls: `obsiminal-terminal-tab${terminal.id === activeId ? " is-active" : ""}`,
          attr: {
            role: "tab",
            "aria-selected": terminal.id === activeId ? "true" : "false",
          },
        });
        if (terminal.state.status === "error" || terminal.state.status === "exited") {
          tab.addClass("has-ended");
        }

        const selectButton = tab.createEl("button", {
          cls: "obsiminal-terminal-tab-select",
          attr: {
            "aria-label": `Switch to ${terminal.label}`,
            title: terminal.shellPath,
            type: "button",
          },
        });
        const icon = selectButton.createSpan({ cls: "obsiminal-terminal-tab-icon" });
        setIcon(icon, "terminal");
        selectButton.createSpan({ cls: "obsiminal-terminal-tab-label", text: terminal.label });
        selectButton.addEventListener("click", () => this.plugin.selectTerminal(terminal.id));

        const tabActions = tab.createDiv({ cls: "obsiminal-terminal-tab-actions" });
        const splitButton = tabActions.createEl("button", {
          cls: "obsiminal-terminal-tab-split",
          attr: {
            "aria-label": `Split ${terminal.label}`,
            title: `Split ${terminal.label}`,
            type: "button",
          },
        });
        setIcon(splitButton, "columns-2");
        splitButton.addEventListener("click", () => {
          this.plugin.selectTerminal(terminal.id);
          this.plugin.splitTerminal();
        });

        const closeButton = tabActions.createEl("button", {
          cls: "obsiminal-terminal-tab-close",
          attr: {
            "aria-label": `Close ${terminal.label}`,
            title: `Close ${terminal.label}`,
            type: "button",
          },
        });
        setIcon(closeButton, "x");
        closeButton.addEventListener("click", () => this.plugin.closeTerminal(terminal.id));
      }
    }
  }

  renderTerminalPanes(
    terminals: TerminalSummary[],
    activeId: string | null,
  ): Map<string, HTMLElement> {
    const panes = new Map<string, HTMLElement>();
    if (!this.terminalContainer) {
      return panes;
    }

    this.terminalContainer.empty();
    this.terminalContainer.toggleClass("has-split", terminals.length > 1);
    for (const [index, terminal] of terminals.entries()) {
      if (index > 0) {
        const previousPane = panes.get(terminals[index - 1].id);
        if (previousPane) {
          const divider = this.terminalContainer.createDiv({
            cls: "obsiminal-split-divider",
            attr: { role: "separator", "aria-orientation": "vertical" },
          });
          this.enableDividerResize(divider, previousPane);
        }
      }

      const pane = this.terminalContainer.createDiv({
        cls: `obsiminal-terminal-pane${terminal.id === activeId ? " is-active" : ""}`,
        attr: {
          "aria-label": terminal.label,
          "data-terminal-id": terminal.id,
        },
      });
      pane.addEventListener("pointerdown", () => this.plugin.selectTerminal(terminal.id));
      panes.set(terminal.id, pane);
    }

    return panes;
  }

  setActivePane(id: string): void {
    if (!this.terminalContainer) {
      return;
    }

    const panes = Array.from(
      this.terminalContainer.querySelectorAll<HTMLElement>(".obsiminal-terminal-pane"),
    );
    for (const pane of panes) {
      pane.toggleClass("is-active", pane.dataset.terminalId === id);
    }
  }

  showEmptyState(): void {
    if (!this.statusElement) {
      return;
    }
    this.statusElement.removeClass("is-hidden");
    this.statusElement.setText("No terminal is running. Use + to create one.");
  }

  showError(message: string): void {
    this.updateState({ status: "error", message });
  }

  updateState(state: TerminalSessionState): void {
    if (!this.statusElement) {
      return;
    }

    if (state.status === "running") {
      this.statusElement.addClass("is-hidden");
      this.statusElement.setText("");
      return;
    }

    this.statusElement.removeClass("is-hidden");

    switch (state.status) {
      case "idle":
        this.statusElement.setText("Terminal is ready to start.");
        break;
      case "starting":
        this.statusElement.setText("Starting terminal…");
        break;
      case "stopped":
        this.statusElement.setText("Terminal stopped. Close it or create a new terminal.");
        break;
      case "exited":
        this.statusElement.setText(
          `Shell exited with code ${state.exitCode}. Close it or create a new terminal.`,
        );
        break;
      case "error":
        this.statusElement.setText(`Unable to start terminal: ${state.message}`);
        break;
    }
  }

  private showProfileMenu(event: MouseEvent): void {
    const menu = new Menu();
    const profiles = this.plugin.getShellProfiles();

    if (profiles.length === 0) {
      menu.addItem((item) => item.setTitle("No shell found").setDisabled(true));
    } else {
      for (const profile of profiles) {
        menu.addItem((item) => {
          item
            .setTitle(profile.label)
            .setIcon("terminal")
            .onClick(() => this.plugin.createTerminal(profile.path));
        });
      }
    }

    menu.showAtMouseEvent(event);
  }

  private enableManagerResize(
    divider: HTMLElement,
    manager: HTMLElement,
    workspace: HTMLElement,
  ): void {
    const resizeManager = (width: number): void => {
      const maximumWidth = Math.max(112, Math.min(360, workspace.clientWidth - 160));
      const nextWidth = Math.round(Math.min(maximumWidth, Math.max(112, width)));
      manager.style.flex = `0 0 ${nextWidth}px`;
      divider.setAttribute("aria-valuenow", String(nextWidth));
      this.plugin.resizeTerminal();
    };

    divider.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = manager.getBoundingClientRect().width;
      let pendingWidth = startWidth;
      let resizeFrame: number | null = null;
      divider.addClass("is-resizing");

      const resize = (moveEvent: PointerEvent): void => {
        pendingWidth = startWidth - (moveEvent.clientX - startX);
        if (resizeFrame === null) {
          resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = null;
            resizeManager(pendingWidth);
          });
        }
      };
      const stop = (): void => {
        divider.removeClass("is-resizing");
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        this.plugin.resizeTerminal();
      };

      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    });

    divider.addEventListener("dblclick", () => {
      manager.style.removeProperty("flex");
      divider.removeAttribute("aria-valuenow");
      this.plugin.resizeTerminal();
    });

    divider.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? 1 : -1;
      resizeManager(manager.getBoundingClientRect().width + direction * 12);
    });
  }

  private enableDividerResize(divider: HTMLElement, leftPane: HTMLElement): void {
    divider.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const rightPane = divider.nextElementSibling;
      if (!(rightPane instanceof HTMLElement)) {
        return;
      }

      const startX = event.clientX;
      const leftWidth = leftPane.getBoundingClientRect().width;
      const rightWidth = rightPane.getBoundingClientRect().width;
      const totalWidth = leftWidth + rightWidth;
      const minimumWidth = Math.min(120, totalWidth / 3);
      let resizeFrame: number | null = null;
      divider.addClass("is-resizing");

      const resize = (moveEvent: PointerEvent): void => {
        const nextLeftWidth = Math.min(
          totalWidth - minimumWidth,
          Math.max(minimumWidth, leftWidth + moveEvent.clientX - startX),
        );
        leftPane.style.flex = `0 0 ${nextLeftWidth}px`;
        rightPane.style.flex = `0 0 ${totalWidth - nextLeftWidth}px`;
        if (resizeFrame === null) {
          resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = null;
            this.plugin.resizeTerminal();
          });
        }
      };
      const stop = (): void => {
        divider.removeClass("is-resizing");
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        this.plugin.resizeTerminal();
      };

      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    });
  }
}
