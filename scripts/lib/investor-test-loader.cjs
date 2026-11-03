const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
module.exports = function createLoader(mocks = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText;
    const resolve = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/")
          ? path.join(root, "src", name.slice(2))
          : path.resolve(path.dirname(filename), name);
        const file = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`].find(
          (value) => fs.existsSync(value) && fs.statSync(value).isFile(),
        );
        if (!file) throw new Error(`Missing test import: ${name}`);
        return load(file);
      }
      return require(name);
    };
    vm.runInNewContext(
      code,
      {
        module,
        exports: module.exports,
        require: resolve,
        console,
        process,
        performance,
        URL,
        URLSearchParams,
        Request,
        Response,
        Error,
        AbortSignal,
        AbortController,
        setTimeout,
        clearTimeout,
      },
      { filename },
    );
    return module.exports;
  }
  return load;
};
