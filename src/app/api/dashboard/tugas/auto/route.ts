import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function compactHarga(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (n >= 1_000_000)     return `Rp ${Math.round(n / 1_000_000)} Jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

/** Format umur (menit yang sudah berlalu) jadi "x hari y jam" / "x jam y menit" / "x menit" */
function fmtAge(min: number): string {
  if (min < 60) return `${Math.round(min)} menit`;
  const h = Math.floor(min / 60);
  if (h < 24) {
    const m = Math.round(min % 60);
    return m ? `${h} jam ${m} menit` : `${h} jam`;
  }
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return hr ? `${d} hari ${hr} jam` : `${d} hari`;
}

/** Format sisa waktu menjadi string yang human-readable */
function fmtSisa(hoursLeft: number): string {
  if (hoursLeft <= 0) {
    const over = Math.abs(hoursLeft);
    if (over < 1) return `${Math.round(over * 60)} menit terlambat`;
    return `${Math.floor(over)} jam terlambat`;
  }
  if (hoursLeft < 1) return `${Math.round(hoursLeft * 60)} menit lagi`;
  if (hoursLeft < 24) return `${Math.floor(hoursLeft)} jam ${Math.round((hoursLeft % 1) * 60)} menit lagi`;
  const days = Math.floor(hoursLeft / 24);
  const hrs  = Math.floor(hoursLeft % 24);
  return hrs > 0 ? `${days} hari ${hrs} jam lagi` : `${days} hari lagi`;
}

/**
 * GET /api/dashboard/tugas/auto
 *
 * Menghasilkan daftar tugas otomatis dari:
 *  1. Leads (new / hot / contacted)
 *  2. Titip Jual yang sudah diklaim — 3 tahap dengan deadline ketat
 *  3. Acara (site visit, buyer meeting, dll — 7 hari ke depan)
 *  4. Listing aktif agent (konten promosi)
 *
 * Tidak menulis apa pun ke DB.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const agentId = (session.user as any).agentId as string | undefined;
    if (!agentId)
      return NextResponse.json({ error: "Bukan akun agent" }, { status: 403 });

    const now         = new Date();
    const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in7Days     = new Date(todayStart);
    in7Days.setDate(todayStart.getDate() + 7);

    // ── 1. Leads (new / hot / contacted) ──────────────────────────────
    const leads = await prisma.lead.findMany({
      where: { id_agent: agentId, status: { in: ["new", "contacted", "hot"] } },
      select: {
        id_lead: true, status: true,
        client_name: true, client_phone: true,
        last_activity: true, created_at: true,
        listing: { select: { judul: true, kota: true } },
      },
      orderBy: { created_at: "desc" },
      take: 30,
    });

    // ── 2. Titip Jual yang diklaim oleh agent ini ──────────────────────
    const titipList = await prisma.propertyTitip.findMany({
      where: { diklaim_oleh_agent: agentId, status: "terklaim" },
      select: {
        id_titip: true,
        pengirim_nama: true, pengirim_phone: true,
        jenis_properti: true, alamat_lengkap: true, kota: true,
        estimasi_harga: true, diklaim_pada: true,
      },
      orderBy: { diklaim_pada: "asc" },
      take: 10,
    });

    // ── 3. Acara 7 hari ke depan ───────────────────────────────────────
    const acara = await prisma.acara.findMany({
      where: {
        OR: [
          { id_agent: agentId },
          { undangan: { some: { id_agent: agentId } } },
        ],
        tanggal_mulai: { gte: todayStart, lte: in7Days },
        status_acara: { in: ["PUBLISHED", "SCHEDULED", "ONGOING", "OPEN_REGISTRATION", "REGISTRATION_CLOSED"] },
        tipe_acara:   { in: ["SITE_VISIT", "BUYER_MEETING", "CLOSING", "FOLLOW_UP", "OPEN_HOUSE"] },
      },
      select: {
        id_acara: true, judul_acara: true,
        tipe_acara: true, tanggal_mulai: true,
        lokasi: true,
        listing: { select: { judul: true } },
      },
      orderBy: { tanggal_mulai: "asc" },
      take: 10,
    });

    // ── 4. Listing aktif (konten promosi) ─────────────────────────────
    const listings = await prisma.listing.findMany({
      where: { id_agent: agentId, status_tayang: "TERSEDIA" },
      select: {
        id_property: true, judul: true, kota: true,
        kategori: true, jenis_transaksi: true, harga: true,
      },
      orderBy: { tanggal_diupdate: "desc" },
      take: 5,
    });

    // ── Build ──────────────────────────────────────────────────────────
    const tasks: object[] = [];

    // ── Tasks dari Leads ───────────────────────────────────────────────
    for (const lead of leads) {
      const refTime = lead.last_activity ?? lead.created_at;
      const ageMin  = Math.max(0, Math.floor((now.getTime() - new Date(refTime).getTime()) / 60000));
      const name    = lead.client_name || null;
      const prop    = lead.listing ? `${lead.listing.judul}, ${lead.listing.kota}` : "Properti";

      const refMs = new Date(refTime).getTime();

      if (lead.status === "new") {
        const urgent = ageMin > 30;
        tasks.push({
          id: `lead-${lead.id_lead}`, source: "lead", sourceId: lead.id_lead.toString(),
          category: urgent ? "URGENT" : "FOLLOWUP",
          title: `Hubungi lead baru — ${prop}`,
          why: urgent
            ? `Lead masuk ${fmtAge(ageMin)} lalu, belum dihubungi. Respons < 30 menit naikan peluang 9×.`
            : `Lead baru masuk ${fmtAge(ageMin)} lalu. Segera hubungi sebelum 30 menit.`,
          overdue: urgent, leadName: name, leadPhone: lead.client_phone,
          leadTemp: "HOT", pipelineStage: "Lead Baru",
          propertyTitle: prop,
          deadline: new Date(refMs + 30 * 60_000).toISOString(),     // SLA: 30 menit
        });
      } else if (lead.status === "hot") {
        const urgent = ageMin > 120;
        tasks.push({
          id: `lead-${lead.id_lead}`, source: "lead", sourceId: lead.id_lead.toString(),
          category: urgent ? "URGENT" : "FOLLOWUP",
          title: `Follow-up HOT buyer${name ? ` — ${name}` : ""}`,
          why: `Lead HOT ${fmtAge(ageMin)} tanpa aktivitas. Hubungi sekarang sebelum minat turun.`,
          overdue: urgent, leadName: name, leadPhone: lead.client_phone,
          leadTemp: "HOT", pipelineStage: "Hot Buyer", propertyTitle: prop,
          deadline: new Date(refMs + 120 * 60_000).toISOString(),    // SLA: 2 jam
        });
      } else if (lead.status === "contacted") {
        const days = Math.floor(ageMin / (60 * 24));
        if (days >= 2) {
          tasks.push({
            id: `lead-${lead.id_lead}`, source: "lead", sourceId: lead.id_lead.toString(),
            category: "FOLLOWUP",
            title: `Follow-up${name ? ` ${name}` : " lead"} — ${days} hari tanpa kabar`,
            why: `${days} hari tidak ada komunikasi. Follow-up rutin jaga hubungan sebelum lead dingin.`,
            overdue: days > 7, leadName: name, leadPhone: lead.client_phone,
            leadTemp: days > 7 ? "COLD" : "WARM", pipelineStage: "Sudah Dikontak", propertyTitle: prop,
            deadline: new Date(refMs + 7 * 24 * 60 * 60_000).toISOString(), // SLA: 7 hari
          });
        }
      }
    }

    // ── Tasks dari Titip Jual ──────────────────────────────────────────
    //
    // Timeline dari diklaim_pada:
    //   Step 1 — Sapa + Discovery Call + TTD MOU   → deadline +24 jam
    //   Step 2 — Site Visit + CMA + Sepakati Harga → deadline +96 jam (24+72)
    //   Step 3 — Upload Listing + Distribusi       → deadline +120 jam (24+72+24)
    //
    // Urgency threshold:
    //   Step 1: kritis jika sisa < 6 jam
    //   Step 2: kritis jika sisa < 12 jam
    //   Step 3: kritis jika sisa < 12 jam

    const STEP_CFG = [
      {
        step: 1, deadlineH: 24,
        category_normal: "FOLLOWUP", category_urgent: "URGENT",
        urgentThresholdH: 6,
        titleFn: (name: string) => `[Titip Jual] Step 1 — Sapa & Discovery Call: ${name}`,
        whyFn: (sisa: string, name: string) =>
          `Sisa ${sisa}. Kirim WA hangat → ajak discovery call 10–15 mnt → gali konteks → TTD MOU. Tanpa MOU komisi tidak terlindungi.`,
        overdueWhyFn: (sisa: string) =>
          `TERLAMBAT ${sisa}! Hubungi pemilik sekarang dan minta maaf atas keterlambatan. Selamatkan leads ini sebelum client kabur.`,
      },
      {
        step: 2, deadlineH: 96,
        category_normal: "VIEWING", category_urgent: "URGENT",
        urgentThresholdH: 12,
        titleFn: (_: string, addr: string) => `[Titip Jual] Step 2 — Site Visit: ${addr}`,
        whyFn: (sisa: string) =>
          `Sisa ${sisa}. Datang ke lokasi, foto & video profesional, catat kondisi fisik, verifikasi dokumen, pasang banner, susun CMA.`,
        overdueWhyFn: (sisa: string) =>
          `TERLAMBAT ${sisa}! Jadwalkan site visit hari ini juga. Foto profesional adalah kunci listing yang terjual cepat.`,
      },
      {
        step: 3, deadlineH: 120,
        category_normal: "PIPELINE", category_urgent: "URGENT",
        urgentThresholdH: 12,
        titleFn: (_: string, addr: string) => `[Titip Jual] Step 3 — Upload Listing: ${addr}`,
        whyFn: (sisa: string) =>
          `Sisa ${sisa}. Upload ke Solusindo Aset + cross-post ke Rumah123/OLX/Lamudi. 7 hari pertama = golden window visibility!`,
        overdueWhyFn: (sisa: string) =>
          `TERLAMBAT ${sisa}! Upload listing SEKARANG. Setiap jam yang berlalu mempersempit golden window 7 hari pertama.`,
      },
    ];

    for (const titip of titipList) {
      if (!titip.diklaim_pada) continue;

      const claimedMs  = new Date(titip.diklaim_pada).getTime();
      const ageHours   = (now.getTime() - claimedMs) / 3_600_000;
      const name       = titip.pengirim_nama;
      const phone      = titip.pengirim_phone;
      const addr       = titip.alamat_lengkap
        ? `${titip.alamat_lengkap.split(",")[0]}, ${titip.kota}`
        : titip.kota;
      const harga      = titip.estimasi_harga ? compactHarga(Number(titip.estimasi_harga)) : null;

      for (const cfg of STEP_CFG) {
        const prevDeadlineH = cfg.step === 1 ? 0 : STEP_CFG[cfg.step - 2].deadlineH;
        const isActive      = ageHours >= prevDeadlineH && ageHours < cfg.deadlineH;
        const isOverdue     = ageHours >= cfg.deadlineH &&
                              // Tampilkan tugas terlambat hanya 48 jam setelah deadline
                              ageHours < cfg.deadlineH + 48;

        if (!isActive && !isOverdue) continue;

        const hoursLeft = cfg.deadlineH - ageHours;
        const overdue   = hoursLeft < 0;
        const urgent    = overdue || hoursLeft < cfg.urgentThresholdH;
        const sisal     = fmtSisa(hoursLeft);

        tasks.push({
          id:            `titip-s${cfg.step}-${titip.id_titip}`,
          source:        "titip",
          sourceId:      titip.id_titip.toString(),
          titipStep:     cfg.step,
          category:      urgent ? cfg.category_urgent : cfg.category_normal,
          title:         cfg.titleFn(name, addr),
          why:           overdue
            ? cfg.overdueWhyFn(sisal)
            : cfg.whyFn(sisal, name),
          overdue,
          leadName:      name,
          leadPhone:     phone,
          leadTemp:      overdue ? "COLD" : cfg.step === 3 ? "WARM" : "HOT",
          pipelineStage: `Tahap ${cfg.step}/3`,
          propertyTitle: harga ? `${addr} · ${harga}` : addr,
          scheduledAt:   null,
          hoursLeft:     Math.round(hoursLeft * 10) / 10,
          deadline:      new Date(claimedMs + cfg.deadlineH * 3_600_000).toISOString(),
        });
      }
    }

    // ── Tasks dari Acara ───────────────────────────────────────────────
    const TIPE_LABEL: Record<string, string> = {
      SITE_VISIT: "Site Visit", BUYER_MEETING: "Pertemuan Buyer",
      CLOSING: "Closing", FOLLOW_UP: "Follow Up", OPEN_HOUSE: "Open House",
    };

    for (const a of acara) {
      const mulai   = new Date(a.tanggal_mulai);
      const isPast  = mulai < now;
      const isToday = mulai.toDateString() === now.toDateString();
      const jam     = mulai.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
      const tgl     = isToday
        ? "hari ini"
        : mulai.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
      const tipeStr = TIPE_LABEL[a.tipe_acara] || a.tipe_acara;

      tasks.push({
        id: `acara-${a.id_acara}`, source: "acara", sourceId: a.id_acara.toString(),
        category: "VIEWING",
        title: `${tipeStr} — ${a.judul_acara}`,
        why: `Jadwal ${tipeStr} ${tgl} pukul ${jam}${a.lokasi ? ` di ${a.lokasi}` : ""}.`,
        overdue: isPast, leadName: null, leadPhone: null, leadTemp: null,
        pipelineStage: null, propertyTitle: a.listing?.judul ?? null,
        scheduledAt: isToday ? jam : null,
        deadline: mulai.toISOString(),
      });
    }

    // ── Tasks dari Listing (konten) ────────────────────────────────────
    for (const l of listings) {
      tasks.push({
        id: `listing-${l.id_property}`, source: "listing", sourceId: l.id_property.toString(),
        category: "KONTEN",
        title: `Post listing — ${l.judul}`,
        why: `Listing aktif di ${l.kota} (${compactHarga(Number(l.harga))}). Promosi rutin meningkatkan visibilitas dan inquiry.`,
        overdue: false, leadName: null, leadPhone: null, leadTemp: null,
        pipelineStage: null, propertyTitle: l.judul,
      });
    }

    // ── 5. Penawaran pending (perlu ditindaklanjuti) ───────────────────
    const penawaranLeads = await prisma.lead.findMany({
      where: { id_agent: agentId, status_penawaran: "pending" },
      select: {
        id_lead: true, client_name: true, client_phone: true,
        penawaran: true, listing: { select: { judul: true, kota: true } },
      },
      take: 20,
    });
    for (const lead of penawaranLeads) {
      const prop = lead.listing ? `${lead.listing.judul}, ${lead.listing.kota}` : "Properti";
      tasks.push({
        id: `penawaran-${lead.id_lead}`, source: "penawaran", sourceId: lead.id_lead.toString(),
        category: "PIPELINE",
        title: `Tindak lanjuti penawaran — ${prop}`,
        why: lead.penawaran
          ? `Penawaran ${compactHarga(Number(lead.penawaran))} berstatus pending. Dorong keputusan agar deal tidak menggantung.`
          : `Penawaran menunggu diajukan. Susun & kirim ke pemilik/buyer hari ini.`,
        overdue: false, leadName: lead.client_name, leadPhone: lead.client_phone,
        leadTemp: "WARM", pipelineStage: "Penawaran", propertyTitle: prop,
        offerAmount: lead.penawaran ? Number(lead.penawaran) : null,
        offerStatus: "pending",
      });
    }

    // ── 6. Cobroke dengan agent partner ────────────────────────────────
    const cobrokeLeads = await prisma.lead.findMany({
      where: { id_agent: agentId, id_agent_cobroke: { not: null } },
      select: {
        id_lead: true, client_name: true, client_phone: true,
        listing: { select: { judul: true, kota: true } },
        agentCobroke: {
          select: {
            nama_kantor: true, nomor_whatsapp: true,
            pengguna: { select: { nama_lengkap: true } },
          },
        },
      },
      take: 20,
    });
    for (const lead of cobrokeLeads) {
      const prop = lead.listing ? `${lead.listing.judul}, ${lead.listing.kota}` : "Properti";
      const co = lead.agentCobroke;
      tasks.push({
        id: `cobroke-${lead.id_lead}`, source: "cobroke", sourceId: lead.id_lead.toString(),
        category: "NETWORKING",
        title: `Koordinasi cobroke — ${prop}`,
        why: "Lead ini dibantu agent partner. Sinkronkan split komisi & langkah closing bersama.",
        overdue: false, leadName: lead.client_name, leadPhone: lead.client_phone,
        leadTemp: "WARM", pipelineStage: "Cobroke", propertyTitle: prop,
        cobrokeAgentName: co?.pengguna?.nama_lengkap ?? null,
        cobrokeAgentOffice: co?.nama_kantor ?? null,
        cobrokeAgentPhone: co?.nomor_whatsapp ?? null,
      });
    }

    // Urutkan: overdue URGENT duluan, lalu berdasarkan step titip jual, lalu sisanya
    tasks.sort((a: any, b: any) => {
      const score = (t: any) => {
        if (t.overdue && t.category === "URGENT") return 0;
        if (t.source === "titip" && t.category === "URGENT") return 1;
        if (t.category === "URGENT") return 2;
        if (t.source === "titip") return 3;
        if (t.category === "FOLLOWUP") return 4;
        if (t.category === "VIEWING") return 5;
        if (t.category === "PIPELINE") return 6;
        return 7;
      };
      return score(a) - score(b);
    });

    // ── Merge persisted per-task meta (channels/split/checklist/snooze) ──
    try {
      const metaRows = await prisma.tugasMeta.findMany({
        where: { id_agent: agentId },
        select: { task_key: true, meta: true },
      });
      if (metaRows.length) {
        const byKey = new Map(metaRows.map((r) => [r.task_key, r.meta]));
        for (const t of tasks as any[]) {
          const m = byKey.get(t.id) as Record<string, any> | undefined;
          if (m) {
            t.meta = m;
            if (m.done === true) t.done = true; // selesai yang tersimpan tetap selesai
          }
        }
      }
    } catch (e) {
      // Tabel belum dimigrasi → lewati tanpa mengganggu daftar tugas.
      console.warn("[tugas/auto] meta merge skipped:", e);
    }

    return NextResponse.json({ tasks });
  } catch (e: any) {
    console.error("[tugas/auto]", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
