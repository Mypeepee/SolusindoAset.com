const fs = require("node:fs");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");
const createLoader = require("./lib/marketing-test-loader.cjs");
dotenv.config({ quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });
const db = new PrismaClient();
(async () => {
  if (process.argv[2] !== "--connect")
    throw new Error("EXPLICIT_CONNECT_ARGUMENT_REQUIRED");
  if (process.env.INSTAGRAM_LOGIN_MODE !== "facebook")
    throw new Error("FACEBOOK_LOGIN_MODE_REQUIRED");
  const token = process.env.INSTAGRAM_DIAGNOSTIC_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("DIAGNOSTIC_TOKEN_REQUIRED");
  delete process.env.INSTAGRAM_DIAGNOSTIC_ACCESS_TOKEN;
  const load = createLoader({ "@/lib/prisma": db });
  const provider = load("src/lib/marketing/instagram.server.ts");
  await provider.connectFacebookInstagramToken(token);
  const connection = await db.marketingConnection.findUniqueOrThrow({
    where: { id: "instagram" },
    select: { accountId: true, username: true, expiresAt: true },
  });
  const settings = await db.marketingSettings.findUnique({
    where: { id: "company" },
    select: { enabled: true },
  });
  let cleared = false;
  const file = ".env.local";
  if (fs.existsSync(file)) {
    const contents = fs.readFileSync(file, "utf8");
    if (
      dotenv.parse(contents).INSTAGRAM_DIAGNOSTIC_ACCESS_TOKEN?.trim() === token
    ) {
      fs.writeFileSync(
        file,
        contents.replace(
          /^(\s*(?:export\s+)?INSTAGRAM_DIAGNOSTIC_ACCESS_TOKEN\s*=)[^\r\n]*/gm,
          "$1",
        ),
      );
      cleared = true;
    }
  }
  console.log(
    JSON.stringify({
      connected: true,
      username: connection.username,
      companyMatches: connection.accountId === process.env.INSTAGRAM_ACCOUNT_ID,
      expiresAt: connection.expiresAt,
      automationEnabled: settings?.enabled === true,
      temporaryTokenCleared: cleared,
    }),
  );
})()
  .catch((error) => {
    const code = error?.code || error?.message;
    console.error(
      JSON.stringify({
        connected: false,
        error:
          typeof code === "string" && /^[A-Z_]{3,80}$/.test(code)
            ? code
            : "FACEBOOK_CONNECTION_FAILED",
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
