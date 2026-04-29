"use client";

import { Icon } from "@iconify/react";

const orders = [
  { name: "Advanced Soft Couch", price: "$427" },
  { name: "Handmade Cotton Chair", price: "$472" },
  { name: "Rustic Rubber Chair", price: "$389" },
];

export default function RecentOrders() {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a0c10] p-6">
      <p className="mb-1 text-xs text-slate-400">Updates from yesterday.</p>
      <p className="mb-4 text-sm text-slate-300">
        You have <span className="font-semibold text-white">16 orders</span> today.
      </p>

      <div className="space-y-3">
        {orders.map((order, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#050608] p-3 hover:border-emerald-400/40 transition-all"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 text-slate-500">
              <Icon icon="solar:box-linear" className="text-2xl" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{order.name}</p>
              <p className="text-xs text-slate-400">{order.price}</p>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-400/40 transition-all">
              <Icon icon="solar:arrow-right-linear" className="text-sm text-slate-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
