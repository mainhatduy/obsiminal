import { PluginSettingTab, Setting, type App } from "obsidian";

import type VaultShellPlugin from "./main";
import type { CustomShellDefinition } from "./settings-data";
import { isShellExecutable } from "./terminal/profiles";

export class VaultShellSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: VaultShellPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName("Custom shells")
      .setDesc("Add any shell executable that Vault Shell does not detect automatically.")
      .addButton((button) =>
        button
          .setButtonText("Add shell")
          .setCta()
          .onClick(() => void this.addShell()),
      );

    for (const shell of this.plugin.settings.customShells) {
      const group = this.containerEl.createDiv({ cls: "obsiminal-settings-shell" });
      new Setting(group)
        .setName(shell.name || "Custom shell")
        .setDesc(
          isShellExecutable(shell.executable)
            ? "Executable is available."
            : "Executable must be an absolute path to an available file.",
        )
        .addButton((button) =>
          button
            .setIcon("trash")
            .setTooltip("Remove custom shell")
            .onClick(() => void this.removeShell(shell.id)),
        );
      new Setting(group)
        .setName("Name")
        .addText((text) =>
          text
            .setValue(shell.name)
            .onChange((value) => void this.updateShell(shell.id, { name: value })),
        );
      new Setting(group).setName("Executable").addText((text) =>
        text
          .setPlaceholder("Absolute path to executable")
          .setValue(shell.executable)
          .onChange((value) => void this.updateShell(shell.id, { executable: value })),
      );
      new Setting(group)
        .setName("Arguments")
        .setDesc("Enter one argument per line.")
        .addTextArea((text) =>
          text
            .setPlaceholder("-d\nUbuntu")
            .setValue(shell.args.join("\n"))
            .onChange(
              (value) =>
                void this.updateShell(shell.id, {
                  args: value
                    .split(/\r?\n/u)
                    .map((argument) => argument.trim())
                    .filter(Boolean),
                }),
            ),
        );
    }
  }

  private async addShell(): Promise<void> {
    this.plugin.settings.customShells.push({
      args: [],
      executable: "",
      id: createCustomShellId(),
      name: "Custom shell",
    });
    await this.plugin.saveSettings();
    this.display();
  }

  private async removeShell(id: string): Promise<void> {
    this.plugin.settings.customShells = this.plugin.settings.customShells.filter(
      (shell) => shell.id !== id,
    );
    await this.plugin.saveSettings();
    this.display();
  }

  private async updateShell(
    id: string,
    update: Partial<Pick<CustomShellDefinition, "args" | "executable" | "name">>,
  ): Promise<void> {
    const shell = this.plugin.settings.customShells.find((candidate) => candidate.id === id);
    if (!shell) {
      return;
    }
    Object.assign(shell, update);
    await this.plugin.saveSettings();
  }
}

function createCustomShellId(): string {
  return `shell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
