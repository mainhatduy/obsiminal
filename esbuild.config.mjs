import esbuild from "esbuild";
import process from "node:process";

const production = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: {
    main: "src/main.ts",
    styles: "src/styles.css",
  },
  bundle: true,
  external: ["obsidian", "electron", "node-pty"],
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
