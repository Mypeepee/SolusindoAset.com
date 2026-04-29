// scripts/remotion-bundle.cjs
const path = require("path");
const fs = require("fs");
const { bundle } = require("@remotion/bundler");

async function main() {
  const entry = path.join(process.cwd(), "remotion", "index.tsx");

  console.log("Bundling Remotion project from:", entry);

  // Simpan bundle di folder khusus di root (bukan di dalam public)
  const outDir = path.join(process.cwd(), ".remotion-bundle");

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const serveUrl = await bundle({
    entryPoint: entry,
    outDir,
    // publicDir: path.join(process.cwd(), "public"), // optional
    webpackOverride: (config) => config,
  });

  console.log("Remotion bundle created.");
  console.log("serveUrl:", serveUrl);
}

main().catch((err) => {
  console.error("Error while bundling Remotion:", err);
  process.exit(1);
});
