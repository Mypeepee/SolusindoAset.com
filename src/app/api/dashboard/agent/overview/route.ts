import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nowPlusHours(h: number) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

export async function GET() {
  // TODO: ganti pakai session + prisma
  return NextResponse.json({
    ok: true,
    data: {
      kpis: {
        newLeads7d: 28,
        followupsDueToday: 7,
        viewings7d: 4,
        activeListings: 13,
        negotiation: 3,
        commissionYtd: 125_000_000,
      },
      pipeline: {
        contacted: 36,
        qualified: 18,
        viewing: 9,
        negotiation: 3,
        closed: 2,
      },
      tasks: [
        { id: "t1", title: "Follow-up lead rumah Darmo", dueAt: nowPlusHours(2), priority: "HIGH", leadName: "Budi", channel: "WA" },
        { id: "t2", title: "Konfirmasi viewing apartemen", dueAt: nowPlusHours(5), priority: "MEDIUM", leadName: "Nadira", channel: "CALL" },
        { id: "t3", title: "Kirim dokumen KPR ke bank", dueAt: nowPlusHours(7), priority: "HIGH", channel: "MEET" },
        { id: "t4", title: "Re-price listing yang sepi inquiry", dueAt: nowPlusHours(9), priority: "LOW" },
      ],
      leads: [
        { id: "l1", name: "Jason C.", status: "HOT", source: "Instagram", lastContactAt: new Date().toISOString(), phone: "+6287812345678" },
        { id: "l2", name: "Nicki N.", status: "WARM", source: "WhatsApp", lastContactAt: new Date(Date.now() - 2 * 864e5).toISOString(), phone: "+6287711112222" },
        { id: "l3", name: "FREDY", status: "COLD", source: "Referral", lastContactAt: new Date(Date.now() - 5 * 864e5).toISOString() },
      ],
      listings: [
        { id: "p1", title: "Rumah Minimalis Citraland", area: "Surabaya Barat", price: 2_350_000_000, inquiries7d: 9, views7d: 220, status: "ACTIVE" },
        { id: "p2", title: "Apartemen 2BR View Kota", area: "Denpasar", price: 1_150_000_000, inquiries7d: 4, views7d: 150, status: "ACTIVE" },
        { id: "p3", title: "Ruko Strategis Jalan Utama", area: "Surabaya Pusat", price: 3_900_000_000, inquiries7d: 2, views7d: 90, status: "DRAFT" },
      ],
      yearlyComparison: {
        pendapatan: {
          thisYear:  148_500_000,
          lastYear:  112_000_000,
          monthly:   [8_200_000, 9_500_000, 11_000_000, 10_800_000, 13_500_000, 14_200_000, 12_800_000, 15_100_000, 16_400_000, 14_900_000, 11_600_000, 10_500_000],
        },
        omzet: {
          thisYear:  4_250_000_000,
          lastYear:  3_180_000_000,
          monthly:   [280_000_000, 310_000_000, 390_000_000, 350_000_000, 420_000_000, 440_000_000, 380_000_000, 460_000_000, 510_000_000, 450_000_000, 360_000_000, 300_000_000],
        },
        totalTransaksi: {
          thisYear:  37,
          lastYear:  28,
          monthly:   [2, 3, 4, 3, 4, 4, 3, 5, 4, 3, 2, 0],
        },
        contacted: {
          thisYear:  214,
          lastYear:  175,
          monthly:   [14, 16, 20, 18, 22, 21, 17, 24, 23, 21, 16, 2],
        },
      },
    },
  });
}