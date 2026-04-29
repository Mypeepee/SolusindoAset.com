"use client";

import { Icon } from "@iconify/react";

const stats = [
  { label: "Visitors", value: "2,110" },
  { label: "Earnings", value: "$8.2M" },
  { label: "Orders", value: "1,124" },
];

const todayOrders = [
  { name: "Advanced Soft Couch", price: "$427" },
  { name: "Handmade Cotton Chair", price: "$472" },
  { name: "Rustic Rubber Chair", price: "$389" },
];

export default function OwnerDashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#050608] text-slate-50">
      {/* SIDEBAR */}
      <aside className="hidden w-64 flex-col border-r border-white/5 bg-[#050608] px-4 py-6 lg:flex">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-black font-semibold">
            A
          </div>
          <span className="text-lg font-semibold tracking-tight">
            aurora
          </span>
        </div>

        {/* HOME SECTION */}
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Homepage
          </p>
          <nav className="space-y-1 text-sm">
            <SideItem label="E-commerce" active />
            <SideItem label="Project" />
            <SideItem label="CRM" />
            <SideItem label="Analytics" />
            <SideItem label="HRM" />
            <SideItem label="Time Tracker" />
            <SideItem label="Hiring" />
          </nav>
        </div>

        {/* APPS SECTION */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Apps
          </p>
          <nav className="space-y-1 text-sm">
            <SideItem label="E-commerce" />
            <SideItem label="CRM" />
            <SideItem label="Invoice" />
            <SideItem label="E-mail" />
            <SideItem label="Events" />
            <SideItem label="Kanban" />
            <SideItem label="Hiring" />
            <SideItem label="Chat" />
            <SideItem label="Social" />
          </nav>
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="flex-1">
        {/* TOP BAR */}
        <header className="flex items-center gap-4 border-b border-white/5 bg-[#050608]/80 px-6 py-4 backdrop-blur">
          <div className="flex-1">
            <div className="flex items-center rounded-full bg-[#0b0d11] px-4 py-2 border border-white/5">
              <Icon
                icon="solar:magnifer-linear"
                className="mr-2 h-4 w-4 text-slate-500"
              />
              <input
                type="text"
                placeholder="Search"
                className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-500 text-slate-100"
              />
            </div>
          </div>

          <button className="rounded-full border border-white/10 bg-[#050608] p-2 text-slate-200 hover:bg-white/5">
            <Icon icon="solar:globe-linear" className="h-4 w-4" />
          </button>
          <button className="rounded-full border border-white/10 bg-[#050608] p-2 text-slate-200 hover:bg-white/5">
            <Icon icon="solar:bell-linear" className="h-4 w-4" />
          </button>
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-[#050608] px-2 py-1 hover:bg-white/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/90 text-black">
              <Icon icon="solar:user-linear" className="h-4 w-4" />
            </div>
          </button>
        </header>

        {/* CONTENT */}
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)]">
          {/* LEFT COLUMN */}
          <section className="space-y-4">
            {/* Greeting + stats summary */}
            <div className="rounded-2xl bg-[#050608] p-6 border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
              <p className="text-xs text-slate-500">
                Friday, Jan 23, 2026
              </p>
              <h1 className="mt-1 text-2xl font-semibold">
                Good morning, <span className="text-emerald-400">Captain!</span>
              </h1>
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Updates from yesterday
              </p>

              <div className="mt-4 space-y-3">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between rounded-xl bg-[#070a0f] px-3 py-3 border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#050608] border border-emerald-500/40">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-50">
                          {s.value}
                        </p>
                        <p className="text-xs text-slate-400">{s.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-xs text-slate-500">
                You have 16 orders today.
              </p>
              <div className="mt-3 space-y-2">
                {todayOrders.map((o) => (
                  <div
                    key={o.name}
                    className="flex items-center justify-between rounded-xl bg-[#070a0f] px-3 py-3 border border-white/5"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-50">
                        {o.name}
                      </p>
                      <p className="text-xs text-slate-500">{o.price}</p>
                    </div>
                    <button className="rounded-full border border-emerald-500/50 bg-[#050608] px-4 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10">
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN */}
          <section className="space-y-4">
            {/* Monthly earnings + visitor value */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-[#050608] p-5 border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
                <p className="text-sm font-semibold text-slate-50">
                  Monthly Earnings
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Total profit gained
                </p>
                <p className="mt-4 text-2xl font-semibold">
                  $25,049
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    +4.33%
                  </span>
                  <span className="text-xs text-slate-500">
                    vs last month
                  </span>
                </div>
                <div className="mt-4 h-24 rounded-xl bg-[#070a0f] border border-white/5" />
              </div>

              <div className="rounded-2xl bg-[#050608] p-5 border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
                <p className="text-sm font-semibold text-slate-50">
                  Visitor Value
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Avg. income per site visit
                </p>
                <p className="mt-4 text-2xl font-semibold">
                  $63.02
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                    -1.03%
                  </span>
                  <span className="text-xs text-slate-500">
                    vs last month
                  </span>
                </div>
                <div className="mt-4 h-24 rounded-xl bg-[#070a0f] border border-white/5" />
              </div>
            </div>

            {/* Promo card */}
            <div className="flex h-64 flex-col justify-between rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-[#050608] p-6 border border-emerald-500/40 shadow-[0_0_50px_rgba(16,185,129,0.5)]">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">
                  Grow your store
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-50">
                  Grow your store confidently.
                </h2>
                <p className="mt-3 text-sm text-slate-200 max-w-md">
                  Access advanced tools and proven strategies to grow your
                  business faster and smarter.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400">
                  Upgrade Now
                </button>
                <button className="rounded-full bg-[#050608] px-5 py-2 text-sm font-semibold text-slate-50 border border-white/20 hover:bg-white/5">
                  Purchase Now
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SideItem({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-emerald-500/15 text-emerald-300"
          : "text-slate-300 hover:bg-white/5 hover:text-emerald-300"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-400" : "bg-slate-500"
        }`}
      />
      <span>{label}</span>
    </button>
  );
}
