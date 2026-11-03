const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
module.exports = function createMarketingLoader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const resolve = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/")
          ? path.join(root, "src", name.slice(2))
          : path.resolve(path.dirname(filename), name);
        const target = [base, base + ".ts", base + ".js"].find(
          (candidate) =>
            fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
        );
        if (!target) throw new Error("Missing module: " + name);
        return load(target);
      }
      return require(name);
    };
    new Function(
      "require",
      "module",
      "exports",
      "__filename",
      "__dirname",
      source,
    )(resolve, mod, mod.exports, filename, path.dirname(filename));
    return mod.exports;
  }
  return load;
};
