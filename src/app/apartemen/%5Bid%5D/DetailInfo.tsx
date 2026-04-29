"use client";
import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";

export default function DetailInfo({ data }: { data: any }) {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div className="w-full lg:w-2/3 space-y-10">
      {/* 1. TITLE, BUTTONS & BADGES */}
      <div className="border-b border-white/5 pb-8">
        <div className="flex justify-between items-start gap-4">
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white leading-tight mb-2">
            {data.title}
          </h1>
          <div className="flex gap-2 shrink-0">
            <button className="bg-[#1A1A1A] w-10 h-10 flex items-center justify-center rounded-full text-white border border-white/10 active:scale-95 transition-transform shadow-lg hover:bg-white/5">
              <Icon icon="solar:share-bold" className="text-lg" />
            </button>
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={`w-10 h-10 flex items-center justify-center rounded-full border active:scale-95 transition-transform shadow-lg bg-[#1A1A1A] hover:bg-white/5 ${
                isFavorite
                  ? "border-red-500/50 text-red-500"
                  : "border-white/10 text-white"
              }`}
            >
              <Icon
                icon={isFavorite ? "solar:heart-bold" : "solar:heart-linear"}
                className="text-lg"
              />
            </button>
          </div>
        </div>

        <p className="text-gray-400 text-sm flex items-center gap-1 mb-4">
          <Icon icon="solar:map-point-bold" className="text-primary" />{" "}
          {data.location}
        </p>

        <div className="flex flex-wrap gap-3">
          <span className="bg-[#1A1A1A] border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
            <Icon icon="solar:bed-bold" className="text-primary" /> {data.type}
          </span>
          <span className="bg-[#1A1A1A] border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
            <Icon icon="solar:ruler-angular-bold" className="text-primary" />{" "}
            {data.sqm} m²
          </span>
          <span className="bg-[#1A1A1A] border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
            <Icon icon="solar:sofa-bold" className="text-primary" />{" "}
            {data.furnish}
          </span>
        </div>
      </div>

      {/* 2. DESCRIPTION */}
      <div className="border-b border-white/5 pb-8">
        <h3 className="text-lg font-bold text-white mb-4">Tentang tempat ini</h3>
        <p className="text-gray-400 text-sm leading-relaxed text-justify">
          {data.description}
        </p>
      </div>

      {/* 3. FACILITIES */}
      <div className="border-b border-white/5 pb-8">
        <h3 className="text-lg font-bold text-white mb-6">Fasilitas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
          <div>
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
              Dalam Unit
            </h4>
            <div className="space-y-3">
              {data.facilities.unit.map((fac: string, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
                  <Icon icon="solar:check-circle-linear" className="text-primary text-lg" />{" "}
                  {fac}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
              Gedung / Area
            </h4>
            <div className="space-y-3">
              {data.facilities.building.map((fac: string, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
                  <Icon icon="solar:city-linear" className="text-white text-lg" />{" "}
                  {fac}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. HOST PROFILE */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-800 border-2 border-white/10 overflow-hidden relative">
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-500">
              {data.owner.avatar}
            </div>
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-primary border-2 border-[#0F0F0F] rounded-full"></div>
          </div>
          <div>
            <h4 className="text-lg font-bold text-white mb-0.5">
              Dikelola oleh {data.owner.name}
            </h4>
            <p className="text-xs text-gray-400">
              Bergabung {data.owner.joined} · Balas {data.owner.response}
            </p>
          </div>
        </div>
        <button className="px-5 py-2.5 rounded-xl border border-white/10 text-white text-sm font-bold hover:bg-white/5 transition-all">
          Hubungi Host
        </button>
      </div>
    </div>
  );
}