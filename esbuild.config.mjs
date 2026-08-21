import esbuild from "esbuild";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const production = process.argv[2] === "production";
const universal = process.argv[3] === "universal";
const nodePtyLicense = readFileSync(path.join("node_modules", "node-pty", "LICENSE"), "utf8");
const runtimeRoot = path.join(".build", "node-pty-runtimes");
const requiredRuntimeKeys = [
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
  "win32-arm64",
  "win32-x64",
];

function readRuntimeFiles(directory, baseDirectory = directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return readRuntimeFiles(filePath, baseDirectory);
    }
    if (!entry.isFile()) {
      return [];
    }

    const relativePath = path.relative(baseDirectory, filePath).split(path.sep).join("/");
    const mode = statSync(filePath).mode & 0o111 ? 0o755 : undefined;
    return [
      {
        contents: readFileSync(filePath).toString("base64"),
        ...(mode === undefined ? {} : { mode }),
        path: relativePath,
      },
    ];
  });
}

const availableRuntimeKeys = requiredRuntimeKeys.filter((key) =>
  existsSync(path.join(runtimeRoot, key)),
);
if (universal && availableRuntimeKeys.length !== requiredRuntimeKeys.length) {
  const missing = requiredRuntimeKeys.filter((key) => !availableRuntimeKeys.includes(key));
  throw new Error(`Universal build is missing node-pty runtimes: ${missing.join(", ")}`);
}
if (availableRuntimeKeys.length === 0) {
  throw new Error("No staged node-pty runtime was found; run the runtime staging script first");
}

const nodePtyRuntimes = Object.fromEntries(
  availableRuntimeKeys.map((key) => [key, readRuntimeFiles(path.join(runtimeRoot, key))]),
);

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
    __NODE_PTY_RUNTIMES__: JSON.stringify(nodePtyRuntimes),
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
