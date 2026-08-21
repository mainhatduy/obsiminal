# Vault Shell

An interactive terminal that runs inside your Obsidian workspace.

Vault Shell opens a real PTY-backed shell in a standard Obsidian pane. Dock it beside your
notes, move it to the bottom of the workspace, or keep it as a tab wherever it fits your
workflow.

![Vault Shell terminal running inside an Obsidian workspace](images/demo.png)

> [!IMPORTANT]
> Vault Shell 0.1.2 is an early macOS-only release. It does not support Obsidian Mobile.

## Features

- Open or focus the terminal with a ribbon icon or the command palette.
- Start each shell in the root directory of the current vault.
- Discover installed shells from `$SHELL`, `/etc/shells`, and `$PATH`.
- Create, switch between, and close multiple terminal sessions from a vertical manager.
- Split terminals side by side in the same group and drag the divider to resize each pane.
- Update each terminal label from its foreground process, then restore the shell name when the
  command exits.
- Run interactive programs with ANSI colors, `Ctrl+C`, terminal resizing, and up to 5,000
  lines of scrollback.
- Keep sessions running when the terminal pane is closed, then reconnect when it is opened
  again.
- Follow Obsidian's light or dark theme automatically.

## Requirements

| Requirement      | Version or details             |
| ---------------- | ------------------------------ |
| Operating system | macOS (Intel or Apple Silicon) |
| Obsidian         | 1.7.2 or later                 |
| Vault            | Local filesystem vault         |

## Installation

Install Vault Shell from **Settings → Community plugins**:

1. Turn on community plugins if they are disabled.
2. Select **Browse**, search for **Vault Shell**, and select **Install**.
3. Select **Enable**.

No Node.js, npm, compiler, or separate `node_modules` directory is required. The Community
Plugins installer downloads the standard `main.js`, `manifest.json`, and `styles.css` files.
`main.js` includes the native PTY runtimes for Intel and Apple Silicon Macs and prepares the
matching runtime locally when the first terminal starts.

To install from source in a test vault instead:

```sh
cd "/path/to/Your Vault/.obsidian/plugins"
git clone <repository-url> obsiminal
cd obsiminal
npm install
npm run build
```

The plugin directory must remain named `obsiminal`. Node.js 24 or later and npm are required
only when building from source.

## Usage

Open the terminal in any of the following ways:

- Select the terminal icon in the ribbon.
- Run **Vault Shell: Open or focus terminal** from the command palette.

Once the terminal is open:

- Drag the **Terminal** tab to dock it anywhere in the workspace.
- Select **+** to create a terminal with the default shell.
- Select the arrow beside **+** to choose another detected shell.
- Select **Split terminal** on the toolbar to open another shell beside the active one.
- Select a terminal in the right sidebar to switch sessions. Split sessions are shown as a
  connected group.
- Drag the divider beside the terminal manager to resize the sidebar; double-click it to restore
  the default width.
- Select **×** on a terminal row to close that session and terminate its process.

You can assign your preferred shortcut under **Settings → Hotkeys**.

### Commands

| Command                                 | Default hotkey | Description                                          |
| --------------------------------------- | -------------- | ---------------------------------------------------- |
| **Vault Shell: Open or focus terminal** | None           | Opens the terminal pane or focuses the existing one. |
| **Vault Shell: New terminal**           | None           | Opens the pane and creates a new terminal session.   |
| **Vault Shell: Split terminal**         | None           | Splits the active terminal into another pane.        |

## Security and privacy

Vault Shell does not require an account, collect telemetry, or make network requests on its
own.

To discover installed shells, Vault Shell uses the Node.js filesystem API to read
`/etc/shells` and check whether shell paths found through `$SHELL` and `$PATH` are executable.
These are read-only checks outside the vault; Vault Shell does not modify those files.
When the first terminal starts, Vault Shell writes its bundled PTY runtime to the plugin's own
`prebuilds` directory. It does not download code or dependencies.

The terminal itself runs with the same permissions as Obsidian and launches a real shell at
the vault root. Commands entered in that shell can read, change, or delete files anywhere your
user account can access, and they may connect to the network. Review commands before running
them and use a test vault while evaluating the plugin.

## Troubleshooting the PTY runtime

If the terminal reports that `pty.node` or `spawn-helper` cannot be loaded:

1. Quit Obsidian completely.
2. Delete the `prebuilds` directory inside
   `<vault>/.obsidian/plugins/obsiminal/`. It contains only generated copies of the runtime
   bundled in `main.js`.
3. Reopen Obsidian and start a terminal so Vault Shell prepares a fresh copy.

If the problem continues, reinstall the plugin from Community Plugins to replace `main.js`,
then report the full error and whether the Mac uses Intel or Apple Silicon.

## Development

Clone the repository anywhere on your machine, then link it into a test vault:

```sh
mkdir -p "/path/to/Test Vault/.obsidian/plugins"
ln -s "/absolute/path/to/obsiminal" "/path/to/Test Vault/.obsidian/plugins/obsiminal"
cd "/absolute/path/to/obsiminal"
npm install
npm run dev
```

After a source change, run **Reload app without saving** from Obsidian's command palette.
You can also disable and re-enable the plugin.

Run the complete quality check before submitting a change:

```sh
npm run validate
```

This command runs ESLint, Prettier checks, tests, TypeScript type checking, and a production
build. The build writes the Obsidian plugin artifacts to the repository root:

- `main.js`
- `manifest.json`
- `styles.css`

### Project structure

- `VaultShellPlugin` manages commands, the workspace view, and terminal sessions.
- `TerminalSession` owns the PTY process and its lifecycle.
- `XtermSurface` manages the xterm.js interface, scrollback, and theme.
- `TerminalView` renders shell selection and session tabs.

## Current limitations

- macOS only.
- Local filesystem vaults only.
- Sessions do not survive an Obsidian restart, reload, or plugin disable.
- Shell, font, and working-directory settings are not configurable yet.

## Contributing

Bug reports and pull requests are welcome. Before opening a pull request, run
`npm run validate` and test the plugin in a separate vault.

## License

Vault Shell is available under the [MIT License](LICENSE). It bundles
[`node-pty`](https://github.com/microsoft/node-pty), which is also available under the MIT
License; its license notice is preserved in the generated `main.js`.
