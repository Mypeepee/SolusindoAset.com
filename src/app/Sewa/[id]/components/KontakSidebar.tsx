"use client";

/**
 * Kolom kanan halaman detail sewa untuk kategori bermode NEGOSIASI —
 * gudang, ruko, toko, pabrik, tanah, dan rumah sewa.
 *
 * ── KENAPA PANEL INI ADA ──────────────────────────────────────────────────
 *
 * Sebelumnya seluruh halaman /Sewa memakai satu panel: panel pemesanan, dengan
 * tab durasi, kalender masuk–keluar, penghitung penghuni, voucher, dan tombol
 * "Ajukan Sewa". Untuk kos & apartemen itu tepat. Untuk sebuah gudang, isinya
 * menanyakan hal yang tidak ada jawabannya: berapa orang yang akan menghuni
 * gudang, tanggal berapa "check-in"-nya, dan voucher apa yang berlaku untuk
 * kontrak yang harganya justru masih akan dirundingkan. Panel itu bukan cuma
 * berlebihan — ia menjanjikan proses instan yang tidak pernah ada. Pemilik
 * gudang tidak menyewakan lewat tombol; ia menyewakan lewat percakapan.
 *
 * Maka kategori NEGOSIASI mendapat panel yang jujur menyebut apa yang benar-
 * benar bisa dilakukan pengunjung hari ini: bicara langsung dengan agent yang
 * menangani aset. Kontrak tahunan dimulai dari percakapan tentang kebutuhan,
 * harga, dan waktu survei—bukan checkout yang pura-pura instan.
 *
 * Yang memutuskan panel mana yang dipakai bukan berkas ini, melainkan
 * `data.modeSewa` yang lahir dari tabel di @/lib/sewaKapabilitas.
 *
 * ── SUSUNAN ───────────────────────────────────────────────────────────────
 *
 * Desktop: kartu sticky, urut sesuai pertanyaan yang muncul di kepala pembaca
 * — berapa harganya → syaratnya apa → siapa yang menangani → mulai chat.
 *
 * Ponsel: kartunya tidak ikut mengalir ke dasar halaman (di sana tidak ada
 * yang akan menemukannya). Yang tampil adalah bilah harga + tombol di tepi
 * bawah layar; harga membuka ringkasan dalam sheet, sedangkan tombol utama
 * langsung membuka WhatsApp. Ini membuat keputusan tetap dekat dengan ibu
 * jari tanpa menyulap kontrak tahunan menjadi alur booking.
 */

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";

import { DURASI_META, formatRupiah } from "@/lib/kosDetail";
import { trackLeadClick } from "@/lib/leadTracking";
import { LABEL_DURASI } from "@/lib/sewaKapabilitas";
import { AKSEN, KILAU_PANEL, LINE, SURFACE } from "./sewaTheme";
import type { SewaDetailData } from "../types";

interface Props {
  data: SewaDetailData;
  /**
   * Pembacanya pemegang listing ini. Tombol kontak disembunyikan — semuanya
   * bermuara ke nomor WhatsApp-nya sendiri. Alat kerjanya ada di Panel Kontrol
   * Agent di atas halaman.
   */
  bolehKelola: boolean;
  /** Sesi belum selesai dibaca — jangan menebak peran pembacanya dulu. */
  menunggu: boolean;
}

const nomorWa = (telepon: string) =>
  telepon.replace(/^0/, "62").replace(/\D/g, "");

export default function KontakSidebar({ data, bolehKelola, menunggu }: Props) {
  const [sheet, setSheet] = useState(false);
  const [sheetSiap, setSheetSiap] = useState(false);
  const [sheetMenutup, setSheetMenutup] = useState(false);
  const awalTarik = useRef<number | null>(null);
  const jarakTarik = useRef(0);
  const [geserSheet, setGeserSheet] = useState(0);
  const [menyeretSheet, setMenyeretSheet] = useState(false);

  // Sheet mengunci scroll halaman di belakangnya — tanpa ini, menggeser di
  // dalam sheet ikut menggerakkan halaman dan sheet terasa "lepas".
  useEffect(() => {
    if (!sheet) return;
    const asal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = asal;
    };
  }, [sheet]);

  const tersewa = data.statusTayang !== "TERSEDIA";
  const durasi = data.durasiUtama;
  const suffix = durasi ? DURASI_META[durasi].suffix : "";
  const hargaTampil = data.hargaPromo ?? data.harga;
  const hematPromo =
    data.hargaPromo != null && data.hargaPromo < data.harga
      ? data.harga - data.hargaPromo
      : 0;
  const persenPromo = hematPromo > 0 ? Math.round((hematPromo / data.harga) * 100) : 0;

  const bukaSheet = () => {
    setSheetMenutup(false);
    setSheetSiap(false);
    setSheet(true);
    requestAnimationFrame(() => setSheetSiap(true));
  };

  const tutupSheet = () => {
    if (!sheet || sheetMenutup) return;
    setGeserSheet(0);
    awalTarik.current = null;
    jarakTarik.current = 0;
    setMenyeretSheet(false);
    setSheetMenutup(true);
    setSheetSiap(false);
    window.setTimeout(() => {
      setSheet(false);
      setSheetMenutup(false);
    }, 280);
  };

  /** Pegangan sheet mengikuti jari agar terasa seperti bottom sheet native.
      Lewat ±96px, sheet ditutup; selain itu ia memantul kembali ke tempatnya. */
  const mulaiTarikSheet = (e: React.TouchEvent<HTMLDivElement>) => {
    awalTarik.current = e.touches[0]?.clientY ?? null;
    jarakTarik.current = 0;
    setMenyeretSheet(true);
  };

  const gerakkanSheet = (e: React.TouchEvent<HTMLDivElement>) => {
    if (awalTarik.current == null) return;
    const titik = e.touches[0]?.clientY;
    if (titik == null) return;
    const jarak = Math.max(0, titik - awalTarik.current);
    jarakTarik.current = jarak;
    setGeserSheet(jarak);
  };

  const selesaiTarikSheet = () => {
    if (awalTarik.current == null) return;
    const harusTutup = jarakTarik.current >= 96;
    awalTarik.current = null;
    setMenyeretSheet(false);
    if (harusTutup) {
      tutupSheet();
      return;
    }
    jarakTarik.current = 0;
    setGeserSheet(0);
  };

  const chatWa = () => {
    void trackLeadClick({
      id_property: data.idProperty,
      id_agent: data.agent.idAgent,
      source: "whatsapp",
    });

    // Pesan pembuka sudah membawa properti & harganya. "Halo" kosong memaksa
    // agent bertanya balik "properti yang mana ya?" — satu putaran percakapan
    // yang hilang begitu saja, dan justru di titik paling rawan ditinggalkan.
    const pesan = [
      `Halo ${data.agent.nama} 👋`,
      "",
      "Saya tertarik menyewa properti ini:",
      `🏠 *${data.judul}*`,
      `📍 ${[data.kecamatan, data.kota].filter(Boolean).join(", ")}`,
      durasi ? `💰 ${formatRupiah(hargaTampil)} ${suffix}` : null,
      `🆔 Kode ${data.idProperty}`,
      `🔗 ${window.location.href}`,
      "",
      "Boleh minta informasi lebih lanjut? Terima kasih 🙏",
    ]
      .filter((baris) => baris !== null)
      .join("\n");

    window.open(
      `https://wa.me/${nomorWa(data.agent.telepon)}?text=${encodeURIComponent(pesan)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  // ───────────────────────────────────────────────────────────────────────
  // POTONGAN ISI
  // ───────────────────────────────────────────────────────────────────────

  const renderHarga = () => (
    <div className="px-5 pb-4 pt-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[2rem] font-extrabold leading-none tracking-tight text-white">
          {formatRupiah(hargaTampil)}
        </span>
        {suffix && (
          <span className="text-sm font-bold text-white/40">{suffix}</span>
        )}
      </div>

      {/* Promo harus terasa seperti nilai yang didapat, bukan sekadar harga
          lama yang dicoret. */}
      {hematPromo > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white/30">
            Dari <span className="line-through">{formatRupiah(data.harga)}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${AKSEN.mint.chip}`}
          >
            <Icon icon="solar:tag-price-bold" className="text-xs" />
            Hemat {persenPromo}%
          </span>
          <span className={`text-[11px] font-bold ${AKSEN.mint.teks}`}>
            −{formatRupiah(hematPromo)}
          </span>
        </div>
      )}

      {/* Kalimat yang menjelaskan MENGAPA tidak ada tombol pesan di sini.
          Tanpa ini, pengunjung yang baru saja melihat halaman kos akan
          mengira panelnya gagal dimuat. */}
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/45">
        <Icon
          icon="solar:hand-shake-bold-duotone"
          className={`mt-px shrink-0 text-sm ${AKSEN.sky.ikon}`}
        />
        <span>
          Harga sewa {durasi ? LABEL_DURASI[durasi] : "properti ini"} masih bisa
          dirundingkan langsung dengan agent.
        </span>
      </p>
    </div>
  );

  const renderSyarat = () => {
    const baris: { label: string; nilai: string; ikon: string }[] = [];

    if (data.minimalSewaJumlah && data.minimalSewaSatuan) {
      baris.push({
        label: "Minimal sewa",
        nilai: `${data.minimalSewaJumlah} ${DURASI_META[data.minimalSewaSatuan].satuan}`,
        ikon: "solar:clock-circle-bold-duotone",
      });
    }
    if (data.deposit != null && data.deposit > 0) {
      baris.push({
        label: "Deposit",
        nilai: formatRupiah(data.deposit),
        ikon: "solar:shield-check-bold-duotone",
      });
    }
    if (data.luasBangunan != null && data.luasBangunan > 0) {
      baris.push({
        label: "Luas bangunan",
        nilai: `${data.luasBangunan.toLocaleString("id-ID")} m²`,
        ikon: "solar:ruler-cross-pen-bold-duotone",
      });
    }

    if (baris.length === 0) return null;

    return (
      <div className={`border-t px-5 py-4 ${LINE.row}`}>
        <div className="space-y-3">
          {baris.map((b) => (
            <div key={b.label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-white/45">
                <Icon icon={b.ikon} className="text-base text-white/30" />
                {b.label}
              </span>
              <span className="text-sm font-bold text-white">{b.nilai}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAgent = () => (
    <div className={`border-t px-5 py-4 ${LINE.row}`}>
      <div
        className="rounded-2xl border border-white/[0.07] p-3"
        style={{ background: SURFACE.raised }}
      >
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
            {data.agent.foto ? (
              <Image
                src={data.agent.foto}
                alt={data.agent.nama}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-base font-black text-white/50">
                {data.agent.nama.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">
              Agent properti Anda
            </p>
            <p className="truncate text-sm font-bold text-white">
              {data.agent.nama}
            </p>
            <p className="truncate text-[11px] font-semibold text-white/40">
              {data.agent.kantor}
            </p>
          </div>
          <Icon
            icon="solar:verified-check-bold"
            className={`shrink-0 text-xl ${AKSEN.emerald.ikon}`}
          />
        </div>
        {(data.agent.kotaArea || data.agent.jumlahClosing > 0) && (
          <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-2.5 text-[10px] font-semibold text-white/40">
            {data.agent.kotaArea && (
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <Icon
                  icon="solar:map-point-bold"
                  className="shrink-0 text-xs text-sky-300"
                />
                {data.agent.kotaArea}
              </span>
            )}
            {data.agent.kotaArea && data.agent.jumlahClosing > 0 && (
              <span className="text-white/15">•</span>
            )}
            {data.agent.jumlahClosing > 0 && (
              <span className="shrink-0">
                {data.agent.jumlahClosing} transaksi selesai
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderAksi = () => {
    if (menunggu) {
      // Rangka diam selama sesi dibaca. Menampilkan tombol dulu lalu
      // menghilangkannya sepersekian detik kemudian jauh lebih mengganggu
      // daripada menunggu sebentar.
      return (
        <div className="px-5 pb-5 pt-4">
          <div className="h-[52px] animate-pulse rounded-2xl bg-white/[0.05]" />
        </div>
      );
    }

    if (bolehKelola) return null;

    return (
      <div className="px-5 pb-5 pt-4">
        <button
          onClick={chatWa}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#86efac] px-4 py-3.5 text-[13px] font-extrabold text-black shadow-[0_10px_30px_-10px_rgba(134,239,172,0.75)] transition-all duration-200 hover:bg-[#a7f3c4] hover:shadow-[0_14px_38px_-10px_rgba(134,239,172,0.9)] active:scale-[0.985] motion-reduce:transition-none"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden"
          />
          <Icon icon="ic:baseline-whatsapp" className="relative text-lg" />
          <span className="relative">
            Chat {data.agent.nama.split(" ")[0]} via WhatsApp
          </span>
        </button>
        <p className="mt-2.5 text-center text-[10px] font-medium text-white/35">
          {tersewa
            ? "Tanyakan properti serupa yang masih tersedia."
            : "Tanyakan harga, ketersediaan, atau jadwal kunjungan."}
        </p>
      </div>
    );
  };

  const renderIsi = () => (
    <>
      {renderHarga()}
      {renderSyarat()}
      {renderAgent()}
      {renderAksi()}
      <div
        className={`flex items-center justify-center gap-2 border-t px-5 py-2.5 ${LINE.row}`}
      >
        <Icon
          icon="solar:shield-check-bold"
          className={`text-sm ${AKSEN.mint.ikon}`}
        />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">
          Agent terverifikasi Solusindo
        </span>
      </div>
    </>
  );

  // ───────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ══════════ DESKTOP ══════════ */}
      <aside className="sticky top-[88px] hidden w-[360px] shrink-0 self-start xl:block">
        <div
          className="relative rounded-[1.75rem] p-px"
          style={{
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03) 38%, rgba(134,239,172,0.10))",
            boxShadow: KILAU_PANEL,
          }}
        >
          <div
            className="relative overflow-hidden rounded-[calc(1.75rem-1px)] backdrop-blur-xl"
            style={{ background: SURFACE.panel }}
          >
            {renderIsi()}
          </div>
        </div>
      </aside>

      {/* ══════════ PONSEL — BILAH BAWAH ══════════
          Ditempelkan ke tepi bawah layar, bukan ke dasar halaman: keputusan
          "hubungi" bisa muncul kapan saja saat membaca, dan menyuruh orang
          menggulir kembali untuk menemukan tombolnya adalah cara termudah
          kehilangan dia. */}
      {!bolehKelola && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] px-4 py-3 backdrop-blur-xl xl:hidden"
          style={{
            background: "rgba(12,16,23,0.92)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto flex max-w-[640px] items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="min-w-0 truncate text-lg font-extrabold leading-tight text-white">
                  {formatRupiah(hargaTampil)}
                  {suffix && (
                    <span className="ml-1 text-xs font-bold text-white/40">
                      {suffix}
                    </span>
                  )}
                </p>
                <button
                  onClick={bukaSheet}
                  aria-label="Lihat rincian sewa dan agent"
                  title="Lihat info"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-amber-300/[0.22] bg-amber-300/[0.07] text-amber-300 transition-colors hover:border-amber-300/45 hover:bg-amber-300/[0.12]"
                >
                  <Icon icon="solar:info-circle-bold" className="text-sm" />
                </button>
              </div>
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-white/35">
                {tersewa
                  ? "Sudah tersewa"
                  : "Harga bisa dirundingkan"}
              </p>
            </div>
            <button
              onClick={chatWa}
              aria-label={`Chat ${data.agent.nama} via WhatsApp`}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#86efac] px-3 text-[13px] font-extrabold text-black shadow-[0_10px_30px_-10px_rgba(134,239,172,0.75)] transition-all active:scale-95 min-[380px]:px-4"
            >
              <Icon icon="ic:baseline-whatsapp" className="text-lg" />
              <span className="hidden min-[380px]:inline">Chat agent</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════ PONSEL — SHEET ══════════
          Isinya persis sama dengan panel desktop, lewat renderIsi() yang sama.
          Dua salinan markup yang "harusnya sama" selalu berakhir berbeda. */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end xl:hidden">
          <div
            className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
              sheetSiap && !sheetMenutup ? "opacity-100" : "opacity-0"
            }`}
            onClick={tutupSheet}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Hubungi agent"
            className={`relative max-h-[85vh] w-full overflow-y-auto rounded-t-[1.75rem] border-t border-white/[0.08] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              sheetSiap && !sheetMenutup
                ? "translate-y-0 opacity-100"
                : "translate-y-full opacity-0"
            } ${menyeretSheet ? "transition-none" : ""}`}
            style={{
              background: SURFACE.panel,
              transform: geserSheet ? `translateY(${geserSheet}px)` : undefined,
            }}
          >
            <div
              onTouchStart={mulaiTarikSheet}
              onTouchMove={gerakkanSheet}
              onTouchEnd={selesaiTarikSheet}
              onTouchCancel={selesaiTarikSheet}
              className="sticky top-0 z-10 flex touch-none items-center justify-center py-3 backdrop-blur-xl"
            >
              <span className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>
            {renderIsi()}
          </div>
        </div>
      )}

    </>
  );
}
