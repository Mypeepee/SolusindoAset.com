import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFileSync } from "fs";
import path from "path";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { docxToPdf } from "@/lib/server/docxToPdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const BULAN_ID = [
  "JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI",
  "JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER",
];
const BULAN_PANJANG = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

function formatTanggal(d: Date): string {
  return `${d.getDate()} ${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`;
}

function composeNomor(idTransaksi: string, d: Date): string {
  const seq = String(idTransaksi.match(/\d+/)?.[0] || "1").padStart(3, "0");
  return `${seq}/INV/SP-SBY/${BULAN_ID[d.getMonth()]}/${d.getFullYear()}`;
}

async function fillDocx(templatePath: string, data: Record<string, string>): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PizZip = require("pizzip");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Docxtemplater = require("docxtemplater");

  const content = readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });

  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as Record<string, string>;
    const { nama_pembeli, keterangan, nilai, id_transaksi, alamat_property, nama_agent } = body;

    if (!nama_pembeli || !keterangan || !nilai || !id_transaksi) {
      return NextResponse.json({ detail: "Field wajib belum lengkap." }, { status: 400 });
    }

    if (!/^\d+$/.test(nilai) || !Number.isSafeInteger(Number(nilai)) || Number(nilai) <= 0)
      return NextResponse.json({ detail: "Nilai invoice harus berupa rupiah bulat positif." }, { status: 400 });
    const nilaiNum = Number(nilai);
    const nilaiFormatted = `Rp ${nilaiNum.toLocaleString("id-ID")}`;

    const transaction = await prisma.transaksi.findUnique({
      where: { id_transaksi }, select: { mou: { select: { id: true } } },
    });
    if (!transaction) return NextResponse.json({ detail: "Transaksi tidak ditemukan." }, { status: 404 });
    let now = new Date();
    const nomor_invoice = composeNomor(String(transaction.mou.id), now);
    const existing = await prisma.invoice.findUnique({ where: { id_invoice: nomor_invoice } });
    if (existing) {
      if (existing.id_transaksi !== id_transaksi || existing.nominal !== BigInt(nilaiNum)
        || existing.ditagihkan_ke !== nama_pembeli.trim() || existing.keterangan !== keterangan.trim())
        return NextResponse.json({ detail: "Nomor invoice sudah tercatat dengan isian berbeda. Periksa invoice yang sudah ada." }, { status: 409 });
      now = existing.tanggal_invoice;
    }
    const tanggal = formatTanggal(now);

    const templatePath = path.join(
      process.cwd(),
      "src/app/dashboard/surat/components/templates/Invoice_Solusindo_Premier_Final.docx",
    );

    const docxBuffer = await fillDocx(templatePath, {
      nomor_invoice,
      tanggal,
      nama_pembeli:   nama_pembeli.trim(),
      alamat_lengkap: (alamat_property || "").trim(),
      nama_agent:     (nama_agent || "").trim(),
      keterangan:     keterangan.trim(),
      nilai:          nilaiFormatted,
      total_nilai:    nilaiFormatted,
    });

    const pdfBuffer = await docxToPdf(docxBuffer);

    if (!existing) await prisma.invoice.create({
      data: {
        id_invoice:      nomor_invoice,
        id_transaksi:    id_transaksi,
        ditagihkan_ke:   nama_pembeli.trim(),
        keterangan:      keterangan.trim(),
        nominal:         BigInt(nilaiNum),
        tanggal_invoice: now,
      },
    });

    const safeNomor = nomor_invoice.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Invoice_${safeNomor}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ detail: "Nomor invoice untuk transaksi ini sudah ada. Pilih invoice yang sudah tercatat untuk membuat kuitansi." }, { status: 409 });
    console.error("[generate-invoice]", e);
    const msg = e instanceof Error ? e.message : "Gagal generate invoice.";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
