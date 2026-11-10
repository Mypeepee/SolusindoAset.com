import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { docxToPdf } from "@/lib/server/docxToPdf";
import { parseSuratValues, permohonanFilename, renderPermohonan, SuratInputError } from "@/lib/server/suratPermohonan";

export function permohonanPost(id: string) {
  return async (request: Request) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ detail: "Sesi login berakhir. Silakan masuk kembali." }, { status: 401 });
    if (!session.user.agentId) return NextResponse.json({ detail: "Pembuatan surat hanya tersedia untuk agent." }, { status: 403 });
    try {
      const body = await request.json().catch(() => { throw new SuratInputError("Data JSON tidak valid."); });
      const values = parseSuratValues(body);
      const docx = await renderPermohonan(id, values);
      const pdf = await docxToPdf(docx, id === "permohonan-eksekusi-pn" ? "pn" : "grosse");
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${permohonanFilename(id, values)}"`,
          "Content-Length": String(pdf.length),
          "Cache-Control": "private, no-store",
        },
      });
    } catch (error) {
      if (error instanceof SuratInputError)
        return NextResponse.json({ detail: error.message }, { status: 400 });
      console.error(`[${id}]`, error);
      return NextResponse.json({ detail: "Dokumen belum berhasil dibuat. Periksa layanan konversi PDF di server lalu coba lagi. Isian Anda tetap tersedia." }, { status: 500 });
    }
  };
}
