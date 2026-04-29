"use client";
import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";

// --- PASTE HELPER COMPONENTS HERE (CalendarModal, GuestCounter) ---
// (Untuk menghemat tempat, copy paste kode CalendarModal & GuestCounter dari kode awalmu ke sini)
// ...

const GuestCounter = ({ label, subLabel, value, onChange, max = 10 }: any) => (
    <div className="flex justify-between items-center py-4 border-b border-white/10 last:border-0">
       <div><p className="text-sm font-bold text-white">{label}</p><p className="text-xs text-gray-400">{subLabel}</p></div>
       <div className="flex items-center gap-3">
          <button onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white disabled:opacity-30 hover:border-white transition-colors"><Icon icon="solar:minus-linear"/></button>
          <span className="text-sm font-bold text-white w-4 text-center">{value}</span>
          <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value === max} className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white disabled:opacity-30 hover:border-white transition-colors"><Icon icon="solar:add-linear"/></button>
       </div>
    </div>
 );

export default function BookingSidebar({ data }: { data: any }) {
  const [bookingPeriod, setBookingPeriod] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [guests, setGuests] = useState({ adults: 1, children: 0, infants: 0, pets: 0 });
  const [isGuestDropdownOpen, setIsGuestDropdownOpen] = useState(false);
  const guestDropdownRef = useRef<HTMLDivElement>(null);
  
  // Logic Calendar Sederhana (Mock)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  const [dateRange, setDateRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });

  const formatRupiah = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  const currentPrice = data.priceRates[bookingPeriod];
  const totalGuests = guests.adults + guests.children;

  useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
        if (guestDropdownRef.current && !guestDropdownRef.current.contains(event.target as Node)) {
           setIsGuestDropdownOpen(false);
        }
     };
     document.addEventListener("mousedown", handleClickOutside);
     return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* --- DESKTOP SIDEBAR --- */}
      <div className="hidden lg:block w-1/3 relative h-fit sticky top-28 self-start">
        <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
          
          {/* Header Price */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-2xl font-bold text-white">{formatRupiah(currentPrice)}</span>
              <span className="text-sm text-gray-400"> / {bookingPeriod === 'daily' ? 'malam' : bookingPeriod === 'monthly' ? 'bulan' : 'tahun'}</span>
            </div>
            <div className="flex items-center gap-1 text-sm font-bold text-white">
                <Icon icon="solar:star-bold" className="text-yellow-500"/> {data.rating}
            </div>
          </div>

          {/* Tab Durasi */}
          <div className="flex bg-black/40 p-1 rounded-xl mb-4">
              {["daily", "monthly", "yearly"].map((type) => (
                <button key={type} onClick={() => setBookingPeriod(type as any)} className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-all ${bookingPeriod === type ? 'bg-primary text-darkmode shadow' : 'text-gray-400 hover:text-white'}`}>{type === 'daily' ? 'Harian' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}</button>
              ))}
          </div>

          {/* Form Inputs (Date & Guest) */}
          <div className="border border-white/20 rounded-xl overflow-hidden mb-4">
             {/* Mock Date Input Visual */}
             <div className="flex border-b border-white/20">
                <div className="flex-1 p-3 border-r border-white/20 cursor-pointer hover:bg-white/5">
                   <label className="block text-[10px] font-bold text-white uppercase mb-0.5">Check-In</label>
                   <span className="text-sm text-gray-300">Pilih Tanggal</span>
                </div>
                <div className="flex-1 p-3 cursor-pointer hover:bg-white/5">
                   <label className="block text-[10px] font-bold text-white uppercase mb-0.5">Check-Out</label>
                   <span className="text-sm text-gray-300">Pilih Tanggal</span>
                </div>
             </div>
             
             {/* Guest Input Trigger */}
             <div className="p-3 hover:bg-white/5 cursor-pointer transition-colors relative" onClick={() => setIsGuestDropdownOpen(!isGuestDropdownOpen)}>
                <div className="flex justify-between items-center">
                    <div><label className="block text-[10px] font-bold text-white uppercase mb-0.5">Tamu</label><span className="text-sm text-white">{totalGuests > 0 ? `${totalGuests} Tamu` : "Tambah Tamu"}</span></div>
                    <Icon icon={isGuestDropdownOpen ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} className="text-white"/>
                </div>
             </div>
          </div>

          {/* Guest Dropdown */}
          <AnimatePresence>
             {isGuestDropdownOpen && (
                <motion.div ref={guestDropdownRef} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-[230px] left-0 w-full bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl p-4 z-50">
                   <GuestCounter label="Dewasa" subLabel="Usia 13+" value={guests.adults} onChange={(val: number) => setGuests({...guests, adults: val})} />
                   <GuestCounter label="Anak-anak" subLabel="Usia 2-12" value={guests.children} onChange={(val: number) => setGuests({...guests, children: val})} />
                   <button onClick={() => setIsGuestDropdownOpen(false)} className="w-full mt-2 text-primary font-bold text-sm text-right hover:underline">Tutup</button>
                </motion.div>
             )}
          </AnimatePresence>

          <button className="w-full bg-primary hover:bg-green-500 text-darkmode font-extrabold text-base py-3.5 rounded-xl shadow-lg shadow-green-500/20 transition-all transform active:scale-95 mb-4">Pesan Sekarang</button>
          
          <div className="text-center text-xs text-gray-500">Anda belum akan dikenakan biaya</div>
        </div>
      </div>

      {/* --- MOBILE BOTTOM BAR (STICKY) --- */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-[#1A1A1A] border-t border-white/10 p-4 z-50 flex justify-between items-center shadow-[0_-5px_20px_rgba(0,0,0,0.5)] safe-area-bottom">
         <div>
            <div className="flex items-end gap-1">
                <span className="text-lg font-bold text-white">{formatRupiah(currentPrice)}</span>
                <span className="text-xs text-gray-400 mb-1">/ {bookingPeriod === 'daily' ? 'mlm' : 'bln'}</span>
            </div>
            <p className="text-[10px] text-primary underline">Lihat rincian</p>
         </div>
         <button className="bg-primary text-darkmode font-bold px-8 py-3 rounded-xl shadow-lg active:scale-95 transition-transform">Pesan</button>
      </div>
    </>
  );
}