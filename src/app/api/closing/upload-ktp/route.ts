import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

export const runtime = "nodejs";
export const maxDuration = 30;

// ── Google Drive OAuth2 helpers (same pattern as daftar-agent) ────────────────

function assertDriveEnv() {
  const required = [
    "GOOGLE_DRIVE_CLIENT_ID",
    "GOOGLE_DRIVE_CLIENT_SECRET",
    "GOOGLE_DRIVE_REFRESH_TOKEN",
    "GOOGLE_DRIVE_FOLDER",
  ];
  for (const k of required) {
    if (!process.env[k]) throw new Error(`${k} belum diset di .env`);
  }
}

async function getAccessToken(): Promise<string> {
  assertDriveEnv();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.access_token)
    throw new Error(data?.error_description ?? "Gagal mendapatkan access_token Google.");
  return data.access_token as string;
}

async function driveFetch(accessToken: string, url: string, init?: RequestInit) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
    });
    if (res.ok) return res;
    const status = res.status;
    const txt = await res.text().catch(() => "");
    if (status < 500 || status > 599 || attempt === 3)
      throw new Error(`Drive error ${status}: ${txt.slice(0, 400)}`);
    await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
  }
  throw new Error("Drive: retry exhausted");
}

async function findOrCreateFolder(accessToken: string, parentId: string, name: string) {
  const q = [
    `mimeType='application/vnd.google-apps.folder'`,
    `name='${name.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    `trashed=false`,
  ].join(" and ");
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id)");
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const res = await driveFetch(accessToken, url.toString(), { method: "GET" });
  const data = await res.json().catch(() => ({} as any));
  const existing = data?.files?.[0]?.id as string | undefined;
  if (existing) return existing;

  // create folder
  const createUrl = new URL("https://www.googleapis.com/drive/v3/files");
  createUrl.searchParams.set("supportsAllDrives", "true");
  const cr = await driveFetch(accessToken, createUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const crData = await cr.json().catch(() => ({} as any));
  return crData.id as string;
}

async function uploadMultipart(
  accessToken: string,
  parentFolderId: string,
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<string> {
  const boundary = "-------kosku_ktp_boundary";
  const metadata = { name: filename, parents: [parentFolderId] };

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const url = new URL("https://www.googleapis.com/upload/drive/v3/files");
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("fields", "id");
  url.searchParams.set("supportsAllDrives", "true");

  const res = await driveFetch(accessToken, url.toString(), {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: body as any,
  });
  const data = await res.json().catch(() => ({} as any));
  const fileId = data.id as string;
  if (!fileId) throw new Error("Drive: fileId tidak ditemukan setelah upload");

  // make public
  const permUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`);
  permUrl.searchParams.set("supportsAllDrives", "true");
  await driveFetch(accessToken, permUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  return fileId;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const namaKlien = (formData.get("nama_klien") as string | null) ?? "klien";

    if (!file) return NextResponse.json({ error: "File wajib disertakan" }, { status: 400 });

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type))
      return NextResponse.json({ error: "Format file tidak didukung. Gunakan JPG, PNG, atau WEBP." }, { status: 400 });

    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: "Ukuran file maksimal 10 MB." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const safeName = namaKlien.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_") || "klien";
    const filename = `KTP_${safeName}_${Date.now()}.${ext}`;

    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER!;
    const accessToken = await getAccessToken();

    // Simpan di subfolder "KTP Klien" agar rapi
    const ktpFolderId = await findOrCreateFolder(accessToken, rootFolderId, "KTP Klien");
    const fileId = await uploadMultipart(accessToken, ktpFolderId, filename, file.type, buffer);

    return NextResponse.json({ ok: true, fileId, filename });
  } catch (err: any) {
    console.error("[upload-ktp]", err);
    return NextResponse.json({ error: err?.message ?? "Gagal upload KTP" }, { status: 500 });
  }
}
