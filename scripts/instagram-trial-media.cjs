// Narrow media-only server for an explicitly requested Instagram trial.
// It never proxies the application and serves only one job's signed JPEG paths.
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const createLoader = require("./lib/marketing-test-loader.cjs");

async function createTrialMediaServer(jobId) {
  if (!/^[a-f0-9-]{36}$/.test(jobId)) throw new Error("INVALID_JOB");
  const load = createLoader({ "@/lib/prisma": {} });
  const { mediaSignature, sameSecret } = load(
    "src/lib/marketing/security.server.ts",
  );
  const prefix = `/api/pemasaran/media/${jobId}/`;
  return http.createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const name = url.pathname.startsWith(prefix)
        ? url.pathname.slice(prefix.length)
        : "";
      if (
        !["GET", "HEAD"].includes(request.method) ||
        !/^(feed|photo-[1-3])\.jpg$/.test(name)
      ) {
        response.writeHead(404).end();
        return;
      }
      const expires = Number(url.searchParams.get("expires"));
      if (
        !Number.isSafeInteger(expires) ||
        expires < Date.now() ||
        expires > Date.now() + 49 * 3600000 ||
        !sameSecret(
          url.searchParams.get("signature") || "",
          mediaSignature(jobId, name, expires),
        )
      ) {
        response.writeHead(403).end();
        return;
      }
      const bytes = await fs.readFile(
        path.join(process.cwd(), "uploads", "marketing", jobId, name),
      );
      response.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": bytes.length,
      });
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
}
module.exports = { createTrialMediaServer };
if (require.main === module) {
  require("dotenv").config({ quiet: true });
  require("dotenv").config({ path: ".env.local", override: true, quiet: true });
  createTrialMediaServer(process.argv[2])
    .then((server) => {
      const port = Number(process.env.INSTAGRAM_TRIAL_MEDIA_PORT || 3043);
      server.listen(port, "127.0.0.1", () =>
        console.log(
          JSON.stringify({ mediaOnly: true, port, jobId: process.argv[2] }),
        ),
      );
    })
    .catch(() => {
      console.error("Media-only server could not start.");
      process.exitCode = 1;
    });
}
