"use client";

import React from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import {
  PillLabel,
  SectionTitle,
} from "../../about/company-profile/components/_shared";

type Item = {
  label: string;
  cost: string;
  included: boolean;
  icon: string;
};

const ITEMS: Item[] = [
  {
    label: "Konsultasi & Survey Lokasi",
    cost: "GRATIS",
    included: true,
    icon: "solar:map-point-bold",
  },
  {
    label: "Comparative Market Analysis (CMA)",
    cost: "GRATIS",
    included: true,
    icon: "solar:graph-new-up-bold",
  },
  {
    label: "Fotografi Profesional & Video",
    cost: "GRATIS",
    included: true,
    icon: "solar:camera-bold",
  },
  {
    label: "Iklan Multi-Channel (MLS, Meta, Google)",
    cost: "GRATIS",
    included: true,
    icon: "solar:rocket-bold",
  },
  {
    label: "Open House & Showing Terjadwal",
    cost: "GRATIS",
    included: true,
    icon: "solar:home-2-bold",
  },
  {
    label: "Negosiasi & Pendampingan AJB",
    cost: "GRATIS",
    included: true,
    icon: "solar:hand-shake-bold",
  },
  {
    label: "Komisi Agent (saat closing)",
    cost: "2,5% – 3%",
    included: false,
    icon: "solar:wallet-money-bold",
  },
];

const Commission: React.FC = () => {
  return (
    <section
      id="komisi"
      className="relative w-full bg-gradient-to-b from-[#05070D] via-[#070A12] to-[#05070D] py-10 sm:py-12 lg:py-14 overflow-hidden"
    >
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[24rem] w-[42rem] rounded-full bg-emerald-500/[0.06] blur-[120px]" />

      <div className="container relative mx-auto px-4 sm:px-6 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Struktur Biaya</PillLabel>
          <SectionTitle
            title={
              <>
                Transparan{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  100%.
                </span>{" "}
                Tanpa Biaya Tersembunyi.
              </>
            }
            subtitle="Semua biaya dijelaskan di awal dan tercantum di Perjanjian Pemasaran Aset. Kami tidak menerima pembayaran apapun di luar struktur ini."
          />
        </div>

        <div className="mt-7 sm:mt-9 grid lg:grid-cols-12 gap-3.5">
          {/* LEFT — main table */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ type: "spring", stiffness: 110, damping: 22 }}
            className="lg:col-span-8 relative rounded-3xl p-[1px] bg-gradient-to-br from-emerald-400/30 via-white/[0.04] to-transparent"
          >
            <div className="relative rounded-3xl bg-[#0B0F17]/95 backdrop-blur-xl p-1.5 sm:p-2 overflow-hidden">
              {/* Header */}
              <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center">
                    <Icon
                      icon="solar:bill-list-bold-duotone"
                      className="text-emerald-300 text-xl"
                    />
                  </div>
                  <div>
                    <div className="text-white font-bold text-[15px]">
                      Rincian Layanan & Biaya
                    </div>
                    <div className="text-white/45 text-[11px] uppercase tracking-[0.18em] font-bold">
                      {ITEMS.length} Item · Update terbaru
                    </div>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-[10.5px] font-bold tracking-[0.16em] uppercase text-emerald-300">
                  <Icon icon="solar:verified-check-bold" className="text-sm" />
                  Tercantum di perjanjian
                </span>
              </div>

              <div className="divide-y divide-white/[0.05] rounded-2xl bg-black/20 mx-1 sm:mx-1">
                {ITEMS.map((it, i) => (
                  <motion.div
                    key={it.label}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-30px" }}
                    transition={{ duration: 0.35, delay: i * 0.03 }}
                    className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 ${
                      !it.included
                        ? "bg-amber-400/[0.025]"
                        : "hover:bg-white/[0.02]"
                    } transition-colors`}
                  >
                    <div
                      className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center border ${
                        it.included
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                          : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                      }`}
                    >
                      <Icon icon={it.icon} className="text-base" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-[13.5px] sm:text-sm font-semibold leading-tight">
                        {it.label}
                      </div>
                      <div className="text-white/45 text-[10.5px] uppercase tracking-[0.14em] font-bold mt-0.5">
                        {it.included ? "Termasuk dalam layanan" : "Dibayar saat closing"}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 text-right font-extrabold tabular-nums text-[13px] sm:text-base ${
                        it.included ? "text-emerald-300" : "text-amber-300"
                      }`}
                    >
                      {it.cost}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-5 py-4 flex items-start gap-2.5">
                <Icon
                  icon="solar:info-circle-bold-duotone"
                  className="text-emerald-300/80 text-base shrink-0 mt-0.5"
                />
                <p className="text-[11.5px] sm:text-[12px] text-white/55 leading-relaxed">
                  Komisi agent dipotong dari nilai transaksi <em>setelah</em>{" "}
                  pembayaran cair. Tidak ada penagihan ke pemilik di luar
                  mekanisme ini.
                </p>
              </div>
            </div>
          </motion.div>

          {/* RIGHT — simulator */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
              type: "spring",
              stiffness: 110,
              damping: 22,
              delay: 0.1,
            }}
            className="lg:col-span-4"
          >
            <CommissionSimulator />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const CommissionSimulator: React.FC = () => {
  const [price, setPrice] = React.useState<number>(1_500_000_000);
  const [rate, setRate] = React.useState<number>(2.5);

  const fmt = (n: number) => {
    if (n >= 1_000_000_000)
      return `Rp ${(n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")} M`;
    if (n >= 1_000_000)
      return `Rp ${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} Jt`;
    return `Rp ${n.toLocaleString("id-ID")}`;
  };

  const commission = (price * rate) / 100;
  const netToOwner = price - commission;

  return (
    <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-emerald-400/30 via-white/[0.04] to-transparent h-full">
      <div className="relative h-full rounded-3xl bg-[#0B0F17]/95 backdrop-blur-xl p-5 sm:p-6 overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-2xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center">
            <Icon
              icon="solar:calculator-minimalistic-bold-duotone"
              className="text-emerald-300 text-xl"
            />
          </div>
          <div>
            <div className="text-white font-bold text-[15px]">
              Simulasi Komisi
            </div>
            <div className="text-emerald-300/80 text-[10.5px] uppercase tracking-[0.2em] font-bold">
              Real-time · Estimasi
            </div>
          </div>
        </div>

        {/* Harga jual slider */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold tracking-[0.16em] uppercase text-white/55">
              Harga Jual
            </label>
            <span className="text-emerald-300 font-extrabold text-[14px] tabular-nums">
              {fmt(price)}
            </span>
          </div>
          <input
            type="range"
            min={300_000_000}
            max={20_000_000_000}
            step={50_000_000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="mt-2 w-full accent-emerald-400 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/35 font-semibold">
            <span>300 Jt</span>
            <span>20 M</span>
          </div>
        </div>

        {/* Komisi rate */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold tracking-[0.16em] uppercase text-white/55">
              Komisi Agent
            </label>
            <span className="text-emerald-300 font-extrabold text-[14px] tabular-nums">
              {rate.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[2.5, 2.75, 3].map((r) => (
              <button
                key={r}
                onClick={() => setRate(r)}
                className={`py-2 rounded-xl text-[12px] font-bold transition-all ${
                  rate === r
                    ? "bg-emerald-400 text-[#05070D]"
                    : "bg-white/[0.04] text-white/70 border border-white/10 hover:bg-white/[0.08]"
                }`}
              >
                {r}%
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        <div className="mt-6 space-y-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
          <Row label="Komisi (success fee)" value={fmt(commission)} muted />
          <div className="h-px bg-white/[0.06]" />
          <Row label="Diterima Pemilik" value={fmt(netToOwner)} highlight />
        </div>

        <div className="mt-4 text-[10.5px] text-white/40 leading-relaxed">
          Estimasi belum termasuk pajak penjual & biaya notaris. Detail final
          dihitung saat closing.
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}> = ({ label, value, muted, highlight }) => (
  <div className="flex items-center justify-between">
    <span
      className={`text-[12px] ${
        muted ? "text-white/55" : "text-white/70"
      } font-semibold`}
    >
      {label}
    </span>
    <span
      className={`tabular-nums font-extrabold ${
        highlight
          ? "text-emerald-300 text-lg sm:text-xl"
          : "text-white/90 text-[13px]"
      }`}
    >
      {value}
    </span>
  </div>
);

export default Commission;
