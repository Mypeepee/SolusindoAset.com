"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";

// --- 1. CONFIGURATION & TYPES ---

const sortAlpha = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b));

const PROPERTY_ICONS: Record<string, string> = {
  "Rumah": "solar:home-2-bold-duotone",
  "Apartemen": "solar:buildings-2-bold-duotone",
  "Gudang": "solar:box-minimalistic-bold-duotone",
  "Tanah": "solar:map-point-wave-bold-duotone",
  "Pabrik": "solar:garage-bold-duotone",
  "Ruko": "solar:shop-2-bold-duotone",
  "Toko": "solar:shop-bold-duotone",
  "Hotel & Villa": "solar:bed-bold-duotone",
};

const LELANG_TYPES = sortAlpha([
  "Rumah", "Tanah", "Gudang", "Apartemen", "Pabrik", "Ruko", "Toko", "Hotel & Villa",
]);

interface Region {
  id: string;
  name: string;
  level: 'provinsi' | 'kota' | 'kecamatan' | 'kelurahan';
}

interface ApiRegion {
  id: string;
  nama: string;
}

interface SearchState {
  locations: Region[];
  type: string;
  minPrice: string;
  maxPrice: string;
  minLt: string;
  maxLt: string;
  minLb: string;
  maxLb: string;
}

// --- 2. HELPERS ---

const parseRawNumber = (val: string) =>
  val.replace(/\./g, "").replace(/[^0-9]/g, "");

const formatIdNumber = (raw: string) =>
  raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : "";

const DB_TYPE_TO_DISPLAY: Record<string, string> = {
  RUMAH: "Rumah",
  TANAH: "Tanah",
  GUDANG: "Gudang",
  APARTEMEN: "Apartemen",
  PABRIK: "Pabrik",
  RUKO: "Ruko",
  TOKO: "Toko",
  HOTEL_DAN_VILLA: "Hotel & Villa",
};

export interface SearchHeroInitial {
  kota?: string;
  tipe?: string;
  minHarga?: number;
  maxHarga?: number;
  minLT?: number;
  maxLT?: number;
  minLB?: number;
  maxLB?: number;
}

const buildFormData = (init: SearchHeroInitial): SearchState => ({
  locations: init.kota
    ? [{ id: init.kota, name: init.kota, level: "kota" as const }]
    : [],
  type: init.tipe ? (DB_TYPE_TO_DISPLAY[init.tipe] ?? "") : "",
  minPrice: init.minHarga ? formatIdNumber(String(init.minHarga)) : "",
  maxPrice: init.maxHarga ? formatIdNumber(String(init.maxHarga)) : "",
  minLt: init.minLT ? formatIdNumber(String(init.minLT)) : "",
  maxLt: init.maxLT ? formatIdNumber(String(init.maxLT)) : "",
  minLb: init.minLB ? formatIdNumber(String(init.minLB)) : "",
  maxLb: init.maxLB ? formatIdNumber(String(init.maxLB)) : "",
});

const SearchHero = ({ initial = {} }: { initial?: SearchHeroInitial }) => {
  const router = useRouter();

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<'provinsi' | 'kota' | 'kecamatan' | 'kelurahan'>('provinsi');
  const [currentList, setCurrentList] = useState<Region[]>([]);
  const [parentRegion, setParentRegion] = useState<Region | null>(null);
  const [loadingWilayah, setLoadingWilayah] = useState(false);

  const [rangeErrors, setRangeErrors] = useState<{ price?: string; lt?: string; lb?: string }>({});
  const [shaking, setShaking] = useState(false);

  const [formData, setFormData] = useState<SearchState>(() => buildFormData(initial));

  useEffect(() => {
    setFormData(buildFormData(initial));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.kota, initial.tipe, initial.minHarga, initial.maxHarga, initial.minLT, initial.maxLT, initial.minLB, initial.maxLB]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const BASE_API = "https://ibnux.github.io/data-indonesia";

  // --- HELPER FUNCTIONS ---

  const mapData = (data: ApiRegion[], level: Region['level']): Region[] =>
    data.map(item => ({ id: item.id, name: item.nama, level }))
        .sort((a, b) => a.name.localeCompare(b.name));

  const getRegionIcon = (level: Region['level']) => {
    switch (level) {
      case 'provinsi': return "solar:globus-bold-duotone";
      case 'kota':     return "solar:buildings-2-bold-duotone";
      case 'kecamatan':return "solar:buildings-bold-duotone";
      case 'kelurahan':return "solar:map-point-wave-bold-duotone";
      default:         return "solar:map-point-bold-duotone";
    }
  };

  const fetchRegions = async (level: Region['level'], parentId?: string) => {
    setLoadingWilayah(true);
    try {
      let url = "";
      if (level === 'provinsi') url = `${BASE_API}/propinsi.json`;
      if (level === 'kota'      && parentId) url = `${BASE_API}/kabupaten/${parentId}.json`;
      if (level === 'kecamatan' && parentId) url = `${BASE_API}/kecamatan/${parentId}.json`;
      if (level === 'kelurahan' && parentId) url = `${BASE_API}/kelurahan/${parentId}.json`;
      if (url) {
        const res  = await fetch(url);
        const data = await res.json();
        setCurrentList(mapData(data, level));
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data wilayah");
    } finally {
      setLoadingWilayah(false);
    }
  };

  useEffect(() => {
    if (openDropdown === "location" && viewLevel === 'provinsi') {
      fetchRegions('provinsi');
    }
  }, [openDropdown]);

  const toggleLocation = (item: Region) => {
    const isAlreadySelected = formData.locations.some(loc => loc.id === item.id);
    if (!isAlreadySelected) {
      toast.success(`${item.name} ditambahkan`, {
        icon: '📍',
        style: { borderRadius: '10px', background: '#333', color: '#fff', fontSize: '12px' },
      });
    }
    setFormData(prev => {
      const exists = prev.locations.find(loc => loc.id === item.id);
      let newLocations = [...prev.locations];
      if (exists) {
        newLocations = newLocations.filter(loc => loc.id !== item.id);
      } else {
        newLocations = newLocations.filter(loc => !item.id.startsWith(loc.id));
        newLocations = newLocations.filter(loc => !loc.id.startsWith(item.id));
        newLocations.push(item);
      }
      return { ...prev, locations: newLocations };
    });
  };

  const handleRowClick = (item: Region) => {
    if (item.level !== 'kelurahan') {
      setParentRegion(item);
      let nextLevel: Region['level'] = 'kota';
      if (item.level === 'provinsi') nextLevel = 'kota';
      if (item.level === 'kota')     nextLevel = 'kecamatan';
      if (item.level === 'kecamatan')nextLevel = 'kelurahan';
      setViewLevel(nextLevel);
      fetchRegions(nextLevel, item.id);
    } else {
      toggleLocation(item);
    }
  };

  const handleBack = () => {
    setViewLevel('provinsi');
    setParentRegion(null);
    fetchRegions('provinsi');
  };

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const n = (val: string) => Number(parseRawNumber(val)) || 0;

  const handleFormattedInput = (e: React.ChangeEvent<HTMLInputElement>, field: keyof SearchState) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    const formatted = rawValue ? new Intl.NumberFormat("id-ID").format(Number(rawValue)) : "";
    const num = Number(rawValue) || 0;
    setFormData(prev => {
      if (field === 'minPrice') setRangeErrors(p => ({ ...p, price: formatted && prev.maxPrice && num > n(prev.maxPrice) ? "Min melebihi Max" : undefined }));
      if (field === 'maxPrice') setRangeErrors(p => ({ ...p, price: formatted && prev.minPrice && num < n(prev.minPrice) ? `Harus ≥ ${prev.minPrice}` : undefined }));
      if (field === 'minLt')    setRangeErrors(p => ({ ...p, lt:    formatted && prev.maxLt    && num > n(prev.maxLt)    ? "Min melebihi Max" : undefined }));
      if (field === 'maxLt')    setRangeErrors(p => ({ ...p, lt:    formatted && prev.minLt    && num < n(prev.minLt)    ? `Harus ≥ ${prev.minLt} m²` : undefined }));
      if (field === 'minLb')    setRangeErrors(p => ({ ...p, lb:    formatted && prev.maxLb    && num > n(prev.maxLb)    ? "Min melebihi Max" : undefined }));
      if (field === 'maxLb')    setRangeErrors(p => ({ ...p, lb:    formatted && prev.minLb    && num < n(prev.minLb)    ? `Harus ≥ ${prev.minLb} m²` : undefined }));
      return { ...prev, [field]: formatted };
    });
  };

  const handleRangeBlur = (field: 'minPrice' | 'maxPrice' | 'minLt' | 'maxLt' | 'minLb' | 'maxLb') => {
    if ((field === 'minPrice' || field === 'maxPrice') && formData.minPrice && formData.maxPrice && n(formData.minPrice) > n(formData.maxPrice))
      setRangeErrors(p => ({ ...p, price: `Max harus ≥ ${formData.minPrice}` }));
    if ((field === 'minLt' || field === 'maxLt') && formData.minLt && formData.maxLt && n(formData.minLt) > n(formData.maxLt))
      setRangeErrors(p => ({ ...p, lt: `Max harus ≥ ${formData.minLt} m²` }));
    if ((field === 'minLb' || field === 'maxLb') && formData.minLb && formData.maxLb && n(formData.minLb) > n(formData.maxLb))
      setRangeErrors(p => ({ ...p, lb: `Max harus ≥ ${formData.minLb} m²` }));
  };

  const hasRangeError = () => !!(rangeErrors.price || rangeErrors.lt || rangeErrors.lb);

  const getLabel = (min: string, max: string, defaultText: string, prefix = "") => {
    if (min && max) return `${prefix}${min} - ${prefix}${max}`;
    if (min) return `Mulai ${prefix}${min}`;
    if (max) return `Hingga ${prefix}${max}`;
    return defaultText;
  };

  const handleSearch = () => {
    if (hasRangeError()) {
      toast.error("Perbaiki range nilai sebelum mencari", { icon: "⚠️" });
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }

    const params = new URLSearchParams();

    if (formData.locations.length > 0) {
      params.set("kota", formData.locations[0].name);
    }

    if (formData.type) {
      let dbType = formData.type.toUpperCase().replace(/\s+/g, "_");
      if (formData.type === "Hotel & Villa") dbType = "HOTEL_DAN_VILLA";
      params.set("tipe", dbType);
    }

    const minPrice = parseRawNumber(formData.minPrice);
    const maxPrice = parseRawNumber(formData.maxPrice);
    if (minPrice) params.set("minHarga", minPrice);
    if (maxPrice) params.set("maxHarga", maxPrice);

    const minLt = parseRawNumber(formData.minLt);
    const maxLt = parseRawNumber(formData.maxLt);
    if (minLt) params.set("minLT", minLt);
    if (maxLt) params.set("maxLT", maxLt);

    const minLb = parseRawNumber(formData.minLb);
    const maxLb = parseRawNumber(formData.maxLb);
    if (minLb) params.set("minLB", minLb);
    if (maxLb) params.set("maxLB", maxLb);

    params.set("page", "1");
    router.push(`/Lelang?${params.toString()}`);
  };

  return (
    <>
      {/* === BAGIAN 1: HERO LELANG === */}
      <section className="relative min-h-[450px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-darkmode via-[#1A1A1A] to-darkmode">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(rgba(134,239,172,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(134,239,172,0.1) 1px,transparent 1px)`, backgroundSize: "50px 50px" }} />
        </div>
        <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "700ms" }} />

        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-16 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-xl border border-emerald-500/30 mb-5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-emerald-400 font-black tracking-[0.28em] text-[10px] uppercase">Peluang Investasi Terbaik</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight mb-4" style={{ textShadow: "0 0 60px rgba(134,239,172,0.2)" }}>
            Temukan{" "}
            <span className="text-emerald-400 drop-shadow-[0_0_20px_rgba(134,239,172,0.4)]">Properti Lelang Terbaik</span>
          </h1>

          <p className="text-slate-300 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-6">
            Dapatkan rumah, tanah, dan aset komersial dengan{" "}
            <span className="text-emerald-400 font-bold">harga di bawah pasaran</span>.
            Proses transparan, legal, dan didampingi tim profesional.
          </p>

          <div className="flex flex-wrap justify-center gap-3 text-xs md:text-sm">
            {[
              { icon: "solar:shield-check-bold-duotone", label: "Legal & Aman" },
              { icon: "solar:medal-star-bold-duotone", label: "Diskon 20–40%" },
              { icon: "solar:ranking-bold-duotone", label: "Bank Terpercaya" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-slate-200 hover:border-emerald-500/50 transition-colors">
                <Icon icon={icon} className="text-emerald-400 text-lg" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-darkmode to-transparent pointer-events-none" />
      </section>

      {/* === BAGIAN 2: FILTER FORM (identik Jual) === */}
      <div className="container mx-auto px-4 relative z-30 -mt-24 mb-10" ref={wrapperRef}>
        <div className="bg-[#1A1A1A] rounded-[2rem] shadow-2xl shadow-black/50 p-2 lg:p-4 border border-white/10 backdrop-blur-md">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center divide-y lg:divide-y-0 lg:divide-x divide-white/10">

            {/* === A. LOKASI === */}
            <div className="w-full lg:w-[28%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
              <div className="cursor-pointer h-full flex flex-col justify-center" onClick={() => toggleDropdown("location")}>
                <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">Lokasi</label>
                <div className="flex items-center gap-2 w-full">
                  <Icon icon="solar:map-point-bold-duotone" className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                  <div className="w-full overflow-x-auto no-scrollbar flex items-center gap-1.5 h-7">
                    {formData.locations.length === 0 ? (
                      <div className="w-full">
                        <p className="font-bold text-white text-sm truncate">Semua Lokasi</p>
                        <p className="text-xs text-gray-500 truncate">Pilih Provinsi, Kota...</p>
                      </div>
                    ) : (
                      formData.locations.map((loc) => (
                        <span
                          key={loc.id}
                          onClick={(e) => { e.stopPropagation(); toggleLocation(loc); }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-white text-[10px] font-bold whitespace-nowrap hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer group-bubble"
                        >
                          {loc.name}
                          <Icon icon="solar:close-circle-bold" className="text-primary group-hover:text-red-400 text-xs" />
                        </span>
                      ))
                    )}
                  </div>
                  <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform shrink-0 ${openDropdown === "location" ? "rotate-180" : ""}`} />
                </div>
              </div>

              {openDropdown === "location" && (
                <div className="absolute top-full left-0 w-full lg:w-[400px] bg-[#222] rounded-2xl shadow-2xl border border-white/10 mt-4 p-0 z-50 animate-fade-in-up overflow-hidden flex flex-col max-h-[400px]">
                  <div className="p-4 border-b border-white/10 bg-[#2A2A2A] flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      {viewLevel !== 'provinsi' && (
                        <button onClick={handleBack} className="p-1.5 hover:bg-white/10 rounded-full transition-colors group">
                          <Icon icon="solar:arrow-left-linear" className="text-lg text-gray-400 group-hover:text-white" />
                        </button>
                      )}
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        <Icon icon={getRegionIcon(viewLevel)} className="text-primary text-lg" />
                        {viewLevel === 'provinsi' ? <span>Pilih Wilayah</span> : <span className="text-primary truncate max-w-[200px] block">{parentRegion?.name}</span>}
                      </h4>
                    </div>
                    {loadingWilayah && <Icon icon="line-md:loading-loop" className="text-primary text-lg" />}
                  </div>

                  <div className="overflow-y-auto custom-scrollbar flex-1 bg-[#1A1A1A]">
                    {viewLevel !== 'provinsi' && parentRegion && (
                      <button onClick={() => toggleLocation(parentRegion)} className="w-full text-left px-4 py-3 bg-primary/5 hover:bg-primary/10 border-b border-white/5 flex items-center gap-3 transition-colors">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.locations.some(l => l.id === parentRegion.id) ? "bg-primary border-primary" : "border-gray-600 bg-transparent"}`}>
                          {formData.locations.some(l => l.id === parentRegion.id) && <Icon icon="solar:check-read-linear" className="text-white text-sm" />}
                        </div>
                        <span className="text-sm font-bold text-white block">Pilih Semua di {parentRegion.name}</span>
                      </button>
                    )}
                    {currentList.map((item) => {
                      const isSelected = formData.locations.some(l => l.id === item.id);
                      const hasChild = item.level !== 'kelurahan';
                      return (
                        <div key={item.id} className="flex items-center justify-between group hover:bg-white/5 border-b border-white/5 last:border-0 pr-2">
                          <button onClick={() => handleRowClick(item)} className="flex-1 flex items-center gap-3 px-4 py-3 text-left">
                            <Icon icon={getRegionIcon(item.level)} className={`text-lg shrink-0 ${isSelected ? "text-primary" : "text-gray-500 group-hover:text-primary"}`} />
                            <div className="flex-1 overflow-hidden">
                              <span className={`text-sm block truncate ${isSelected ? "font-bold text-primary" : "font-medium text-gray-300"}`}>{item.name}</span>
                              {hasChild && <span className="text-[10px] text-gray-500 group-hover:text-primary transition-colors">Lihat {item.level === 'provinsi' ? 'Kota' : item.level === 'kota' ? 'Kecamatan' : 'Kelurahan'}</span>}
                            </div>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); toggleLocation(item); }} className="p-3 hover:bg-white/10 rounded-lg transition-colors">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary" : "border-gray-600 bg-transparent"}`}>
                              {isSelected && <Icon icon="solar:check-read-linear" className="text-white text-sm" />}
                            </div>
                          </button>
                          {hasChild && (
                            <button onClick={() => handleRowClick(item)} className="p-2 text-gray-500 hover:text-primary">
                              <Icon icon="solar:alt-arrow-right-linear" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* === B. TIPE ASET === */}
            <div className="w-full lg:w-[18%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
              <div className="cursor-pointer" onClick={() => toggleDropdown("type")}>
                <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">Tipe Aset</label>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:buildings-bold-duotone" className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                  <div className="w-full overflow-hidden">
                    <p className="font-bold text-white text-sm truncate">{formData.type || "Semua Tipe"}</p>
                  </div>
                  <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform ${openDropdown === "type" ? "rotate-180" : ""}`} />
                </div>
              </div>

              {openDropdown === "type" && (
                <div className="absolute top-full left-0 w-full lg:w-[280px] bg-[#222] rounded-2xl shadow-2xl border border-white/10 mt-4 p-2 z-50 animate-fade-in-up max-h-[300px] overflow-y-auto custom-scrollbar">
                  <button onClick={() => { setFormData(prev => ({ ...prev, type: "" })); setOpenDropdown(null); }} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-3 ${formData.type === "" ? "bg-primary/10 text-primary" : "text-gray-300 hover:bg-white/5"}`}>
                    <Icon icon="solar:apps-bold-duotone" className="text-lg opacity-70" />
                    Semua Tipe
                  </button>
                  {LELANG_TYPES.map((item) => (
                    <button key={item} onClick={() => { setFormData(prev => ({ ...prev, type: item })); setOpenDropdown(null); }} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-3 ${formData.type === item ? "bg-primary/10 text-primary" : "text-gray-300 hover:bg-white/5"}`}>
                      <Icon icon={PROPERTY_ICONS[item] || "solar:home-bold-duotone"} className="text-lg opacity-70" />
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* === C. HARGA === */}
            <div className="w-full lg:w-[22%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
              <div className="cursor-pointer" onClick={() => toggleDropdown("price")}>
                <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">Harga</label>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:wallet-money-bold-duotone" className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                  <div className="w-full overflow-hidden">
                    <p className="font-bold text-white text-sm truncate">{getLabel(formData.minPrice, formData.maxPrice, "Range Harga")}</p>
                  </div>
                  <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform ${openDropdown === "price" ? "rotate-180" : ""}`} />
                </div>
              </div>

              {openDropdown === "price" && (
                <div className="absolute top-full left-0 w-full lg:w-[320px] bg-[#222] rounded-2xl shadow-2xl border border-white/10 mt-4 p-5 z-50 animate-fade-in-up">
                  <h4 className="font-bold text-white mb-3 text-sm">Range Harga (Rp)</h4>
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="Min" value={formData.minPrice} onChange={(e) => handleFormattedInput(e, 'minPrice')} onBlur={() => handleRangeBlur('minPrice')} className={`w-1/2 bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none text-white font-medium placeholder:text-gray-600 ${rangeErrors.price ? "border-red-500/70" : "border-white/10"}`} />
                    <span className="text-gray-500 font-medium">s/d</span>
                    <input type="text" placeholder="Max" value={formData.maxPrice} onChange={(e) => handleFormattedInput(e, 'maxPrice')} onBlur={() => handleRangeBlur('maxPrice')} className={`w-1/2 bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none text-white font-medium placeholder:text-gray-600 ${rangeErrors.price ? "border-red-500/70" : "border-white/10"}`} />
                  </div>
                  {rangeErrors.price && <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1"><Icon icon="solar:danger-triangle-bold-duotone" className="shrink-0 text-sm"/>{rangeErrors.price}</p>}
                </div>
              )}
            </div>

            {/* === D. DIMENSI === */}
            <div className="w-full lg:w-[22%] px-4 lg:px-5 py-4 lg:py-3 relative group min-w-0">
              <div className="cursor-pointer" onClick={() => toggleDropdown("dimensions")}>
                <label className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase mb-1 block group-hover:text-primary transition-colors">Dimensi</label>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:ruler-angular-bold-duotone" className="text-2xl text-gray-400 group-hover:text-primary transition-colors shrink-0" />
                  <div className="w-full overflow-hidden">
                    <p className="font-bold text-white text-sm truncate">
                      {formData.minLt || formData.maxLt
                        ? getLabel(formData.minLt, formData.maxLt, "", "LT: ") + " m²"
                        : "Luas Tanah/Bangunan"}
                    </p>
                  </div>
                  <Icon icon="solar:alt-arrow-down-linear" className={`text-gray-400 transition-transform ${openDropdown === "dimensions" ? "rotate-180" : ""}`} />
                </div>
              </div>

              {openDropdown === "dimensions" && (
                <div className="absolute top-full right-0 lg:left-auto left-0 w-full lg:w-[320px] bg-[#222] rounded-2xl shadow-2xl border border-white/10 mt-4 p-5 z-50 animate-fade-in-up">
                  <div className="mb-4">
                    <h4 className="font-bold text-white mb-2 text-sm flex items-center gap-2"><Icon icon="solar:map-bold" className="text-gray-400" /> Luas Tanah (m²)</h4>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Min" value={formData.minLt} onChange={(e) => handleFormattedInput(e, 'minLt')} onBlur={() => handleRangeBlur('minLt')} className={`w-1/2 bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-600 text-white ${rangeErrors.lt ? "border-red-500/70" : "border-white/10"}`} />
                      <span className="text-gray-500">-</span>
                      <input type="text" placeholder="Max" value={formData.maxLt} onChange={(e) => handleFormattedInput(e, 'maxLt')} onBlur={() => handleRangeBlur('maxLt')} className={`w-1/2 bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-600 text-white ${rangeErrors.lt ? "border-red-500/70" : "border-white/10"}`} />
                    </div>
                    {rangeErrors.lt && <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1"><Icon icon="solar:danger-triangle-bold-duotone" className="shrink-0 text-sm"/>{rangeErrors.lt}</p>}
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-2 text-sm flex items-center gap-2"><Icon icon="solar:home-bold" className="text-gray-400" /> Luas Bangunan (m²)</h4>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Min" value={formData.minLb} onChange={(e) => handleFormattedInput(e, 'minLb')} onBlur={() => handleRangeBlur('minLb')} className={`w-1/2 bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-600 text-white ${rangeErrors.lb ? "border-red-500/70" : "border-white/10"}`} />
                      <span className="text-gray-500">-</span>
                      <input type="text" placeholder="Max" value={formData.maxLb} onChange={(e) => handleFormattedInput(e, 'maxLb')} onBlur={() => handleRangeBlur('maxLb')} className={`w-1/2 bg-[#1A1A1A] border rounded-xl px-3 py-2.5 text-sm focus:border-primary outline-none font-medium placeholder:text-gray-600 text-white ${rangeErrors.lb ? "border-red-500/70" : "border-white/10"}`} />
                    </div>
                    {rangeErrors.lb && <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1"><Icon icon="solar:danger-triangle-bold-duotone" className="shrink-0 text-sm"/>{rangeErrors.lb}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* === E. TOMBOL CARI === */}
            <div className="w-full lg:w-[10%] p-4 lg:p-2 shrink-0 flex items-center justify-center">
              <motion.button
                onClick={handleSearch}
                animate={shaking ? { x: [0, -16, 16, -16, 16, -16, 16, -12, 12, -8, 8, 0], rotate: [0, -3, 3, -3, 3, -3, 3, -2, 2, -1, 1, 0] } : {}}
                transition={{ duration: 0.7, ease: "easeInOut" }}
                className="w-full lg:w-14 h-14 bg-primary hover:bg-[#6ee7b7] text-darkmode rounded-2xl lg:rounded-full font-bold text-lg flex items-center justify-center shadow-lg shadow-primary/30 transition-all transform active:scale-95"
              >
                <Icon icon="solar:magnifer-linear" className="text-2xl stroke-2" />
                <span className="lg:hidden ml-2">Cari</span>
              </motion.button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default SearchHero;
