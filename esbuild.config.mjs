import esbuild from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const production = process.argv[2] === "production";
const nodePtyLicense = readFileSync(path.join("node_modules", "node-pty", "LICENSE"), "utf8");

function encodeNodePtyAsset(architecture, fileName) {
  return readFileSync(
    path.join("node_modules", "node-pty", "prebuilds", `darwin-${architecture}`, fileName),
  ).toString("base64");
}

const context = await esbuild.context({
  banner: {
    js: `/* Bundled dependency: node-pty 1.1.0\n\n${nodePtyLicense}\n*/`,
  },
  entryPoints: {
    main: "src/main.ts",
    styles: "src/styles.css",
  },
  bundle: true,
  define: {
    __NODE_PTY_DARWIN_ARM64_HELPER__: JSON.stringify(encodeNodePtyAsset("arm64", "spawn-helper")),
    __NODE_PTY_DARWIN_ARM64_MODULE__: JSON.stringify(encodeNodePtyAsset("arm64", "pty.node")),
    __NODE_PTY_DARWIN_X64_HELPER__: JSON.stringify(encodeNodePtyAsset("x64", "spawn-helper")),
    __NODE_PTY_DARWIN_X64_MODULE__: JSON.stringify(encodeNodePtyAsset("x64", "pty.node")),
  },
  external: ["obsidian", "electron"],
  format: "cjs",
  logLevel: "info",
  minify: production,
  outdir: ".",
  platform: "node",
  sourcemap: production ? false : "inline",
  target: "es2022",
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
