"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "./sidebar";
import { useSwipe } from "@/hooks/useSwipe";
import { smoothScrollToElement } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

// --- TIPE DATA ---
interface PropertyDB {
  id_property: string;
  slug: string;
  judul: string;
  kota: string;
  harga: number;
  harga_promo: number | null; // harga diskon
  jenis_transaksi: string; // PRIMARY / SECONDARY / LELANG / SEWA
  kategori: string;
  gambar: string;
  foto_list: string[];
  luas_tanah: number;
  luas_bangunan: number;
  kamar_tidur: number;
  kamar_mandi: number;
  agent_name: string;
  agent_photo: string;
  agent_office: string;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

interface ProductListProps {
  initialData: PropertyDB[];
  pagination: PaginationData;
}

// --- CONSTANTS ---
const PROPERTY_ICONS: Record<string, string> = {
  RUMAH: "solar:home-2-bold-duotone",
  APARTEMEN: "solar:buildings-2-bold-duotone",
  GUDANG: "solar:box-minimalistic-bold-duotone",
  TANAH: "solar:map-point-wave-bold-duotone",
  PABRIK: "solar:garage-bold-duotone",
  RUKO: "solar:shop-2-bold-duotone",
  TOKO: "solar:shop-bold-duotone",
  HOTEL: "solar:bed-bold-duotone",
  VILLA: "solar:star-fall-bold-duotone",
};

// --- UTILS ---
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const getBadgeColor = (type: string) => {
  const t = type?.toUpperCase();
  if (t === "PRIMARY") return "bg-blue-500 shadow-blue-500/20";
  if (t === "SECONDARY") return "bg-violet-500 shadow-violet-500/20";
  if (t === "LELANG") return "bg-amber-500 shadow-amber-500/20";
  if (t === "SEWA") return "bg-emerald-500 shadow-emerald-500/20";
  return "bg-gray-500 shadow-gray-500/20";
};

const getPropertyIcon = (kategori: string): string => {
  const key = kategori?.trim().toUpperCase();
  return PROPERTY_ICONS[key] || "solar:home-2-bold-duotone";
};

// URL detail Jual/SEWA
const getPropertyUrl = (property: PropertyDB): string => {
  const transactionType = property.jenis_transaksi?.toUpperCase();
  const urlPath = transactionType === "SEWA" ? "Sewa" : "Jual";
  const baseSlug = property.slug || "property";
  const slugWithId = `${baseSlug}-${property.id_property}`;
  return `/${urlPath}/${slugWithId}`;
};

// --- CARD ---
const PropertyCard = ({ item }: { item: PropertyDB }) => {
  const kategoriUpper = item.kategori?.trim().toUpperCase() || "";

  const images =
    item.foto_list && item.foto_list.length > 0
      ? item.foto_list
      : [item.gambar || "/images/hero/banner.jpg"];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const currentImage = images[currentImageIndex];

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const swipe = useSwipe(nextImage, prevImage);

  const hasDiscount =
    item.harga_promo != null &&
    item.harga_promo > 0 &&
    item.harga_promo < item.harga;

  const discountPercent = hasDiscount
    ? Math.round(((item.harga - item.harga_promo!) / item.harga) * 100)
    : 0;

  const mainPrice = hasDiscount ? item.harga_promo! : item.harga;

  return (
    <div className="bg-[#111111] border border-white/5 rounded-3xl overflow-hidden group transition-all duration-300 flex flex-col h-full hover:border-emerald-400/70 hover:shadow-[0_24px_70px_-30px_rgba(16,185,129,0.7)]">
      {/* IMAGE */}
      <div
        className="relative w-full h-72 md:h-80 overflow-hidden"
        {...(images.length > 1 ? swipe : {})}
      >
        <Image
          key={currentImage}
          src={currentImage}
          alt={item.judul}
          fill
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 33vw"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/0" />

        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center z-20 transition-all lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Icon icon="solar:alt-arrow-left-linear" className="text-lg" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center z-20 transition-all lg:opacity-0 lg:group-hover:opacity-100"
            >
              <Icon icon="solar:alt-arrow-right-linear" className="text-lg" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentImageIndex
                      ? "bg-white w-4"
                      : "bg-white/40 w-2"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* BADGE BAR */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2">
          <span
            className={`${getBadgeColor(
              item.jenis_transaksi
            )} text-white text-[10px] font-semibold px-3 py-1.5 rounded-full shadow-md uppercase tracking-wide inline-flex items-center gap-1`}
          >
            <Icon
              icon="solar:star-bold-duotone"
              className="text-xs opacity-90"
            />
            {item.jenis_transaksi}
          </span>

          <span className="ml-auto bg-black/70 backdrop-blur-sm border border-white/10 text-white text-[10px] font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
            <Icon
              icon={getPropertyIcon(item.kategori)}
              className="text-sm opacity-90"
            />
            {kategoriUpper}
          </span>
        </div>

        {/* DISCOUNT BADGE API */}
        {hasDiscount && (
          <div className="absolute bottom-4 right-3 z-20">
            {/* glow api belakang */}
            <div className="absolute inset-0 blur-xl bg-gradient-to-r from-rose-500/40 via-orange-500/40 to-amber-400/40 opacity-70 animate-pulse pointer-events-none" />
            {/* titik api kecil */}
            <span className="absolute -top-2 -right-1 w-3 h-3 rounded-full bg-amber-300 animate-ping" />

            <div className="relative bg-gradient-to-r from-rose-600 via-orange-500 to-amber-400 text-white px-3.5 py-1.5 rounded-full text-[11px] font-extrabold tracking-wide shadow-[0_0_20px_rgba(248,113,113,0.9)] flex items-center gap-1.5 animate-[wiggle_1.2s_ease-in-out_infinite]">
              <Icon
                icon="solar:fire-bold-duotone"
                className="text-sm drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]"
              />
              <span>-{discountPercent}%</span>
            </div>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="p-5 md:p-6 flex flex-col flex-grow gap-3">
        {/* Harga */}
        <div className="space-y-1.5">
          {hasDiscount ? (
            <>
              <div className="flex items-center gap-2">
                <h3 className="text-white text-xl font-black tracking-tight">
                  {formatCurrency(mainPrice)}
                </h3>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Hemat {formatCurrency(item.harga - mainPrice)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 line-through decoration-2 decoration-rose-400/80">
                  {formatCurrency(item.harga)}
                </span>
                <span className="text-gray-500">
                  Sebelum diskon
                </span>
              </div>
            </>
          ) : (
            <h3 className="text-white text-xl font-black tracking-tight">
              {formatCurrency(mainPrice)}
            </h3>
          )}
        </div>

        <h4
          className="text-gray-100 text-sm md:text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors"
          title={item.judul}
        >
          {item.judul}
        </h4>

        <div className="flex items-start gap-2 text-xs text-gray-400">
          <Icon
            icon="solar:map-point-wave-bold"
            className="text-primary text-base shrink-0 mt-0.5"
          />
          <span className="line-clamp-1" title={item.kota}>
            {item.kota}
          </span>
        </div>

        {/* Specs */}
        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
          <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-500">KT</span>
              <span className="text-white font-semibold inline-flex justify-center items-center gap-1">
                <Icon
                  icon="solar:bed-bold"
                  className="text-xs text-gray-400"
                />
                {item.kamar_tidur || "-"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-500">KM</span>
              <span className="text-white font-semibold inline-flex justify-center items-center gap-1">
                <Icon
                  icon="solar:bath-bold"
                  className="text-xs text-gray-400"
                />
                {item.kamar_mandi || "-"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-500">LT</span>
              <span className="text-white font-semibold">
                {item.luas_tanah}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-500">LB</span>
              <span className="text-white font-semibold">
                {item.luas_bangunan || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* footer agent */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-3 border-t border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/15 shrink-0">
              <Image
                src={item.agent_photo || "/images/user/user-01.png"}
                alt="Agent"
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-gray-100 leading-tight">
                {item.agent_name}
              </span>
              <span className="text-[10px] text-gray-500 leading-tight">
                {item.agent_office}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-primary flex items-center gap-1 shrink-0">
            Lihat detail
            <Icon icon="solar:arrow-right-linear" className="text-sm" />
          </span>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const ProductList = ({ initialData, pagination }: ProductListProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productListRef = useRef<HTMLDivElement>(null);
  const prevPageRef = useRef<number>(pagination.currentPage);

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const filterKota = searchParams.get("kota") || "";
  const BASE_URL = "/Jual";

  const handlePageChange = (newPage: number) => {
    if (newPage === pagination.currentPage) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${BASE_URL}?${params.toString()}`, { scroll: false });
  };

  // Smooth-scroll to the first card row once the new page has rendered.
  useEffect(() => {
    if (prevPageRef.current === pagination.currentPage) return;
    prevPageRef.current = pagination.currentPage;
    requestAnimationFrame(() => {
      if (productListRef.current) smoothScrollToElement(productListRef.current);
    });
  }, [pagination.currentPage]);

  return (
    <>
      <div className="container mx-auto px-4 mt-12 mb-24" ref={productListRef}>
        {/* MOBILE FILTER DRAWER */}
        <AnimatePresence>
          {isMobileFilterOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileFilterOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] lg:hidden"
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-[85%] max-w-[320px] bg-[#121212] z-[70] border-l border-white/10 shadow-2xl lg:hidden overflow-y-auto"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                      <Icon
                        icon="solar:filter-bold-duotone"
                        className="text-primary"
                      />{" "}
                      Filter
                    </h3>
                    <button
                      onClick={() => setIsMobileFilterOpen(false)}
                      className="p-2 bg_WHITE/5 hover:bg_WHITE/10 rounded-full text-white transition-colors"
                    >
                      <Icon
                        icon="solar:close-circle-bold"
                        className="text-xl"
                      />
                    </button>
                  </div>
                  <div className="pb-20">
                    <Sidebar />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* AREA PRODUK */}
          <div className="w-full lg:w-3/4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white font-bold text-lg md:text-xl leading-tight">
                  {filterKota
                    ? `Properti di "${filterKota}"`
                    : "Listing Primary & Secondary"}
                </h2>
                <span className="text-xs md:text-sm font-normal text-gray-400 mt-1 block">
                  ({pagination.totalItems} ditemukan)
                </span>
              </div>

              <button
                onClick={() => setIsMobileFilterOpen(true)}
                className="lg:hidden shrink-0 flex items-center gap-2 text-white bg-white/5 border border-white/20 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white/10 hover:border-primary/50 transition-all active:scale-95 ml-4"
              >
                <Icon icon="solar:filter-bold" className="text-primary" />{" "}
                Filter
              </button>
            </div>

            {initialData && initialData.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {initialData.map((item) => (
                  <motion.div
                    key={item.id_property}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Link href={getPropertyUrl(item)} className="block h-full">
                      <PropertyCard item={item} />
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white/5 rounded-3xl border border_WHITE/5">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon
                    icon="solar:sad-square-bold-duotone"
                    className="text-4xl text-gray-500"
                  />
                </div>
                <h3 className="text-white font-bold text-xl mb-2">
                  Belum Ada Properti
                </h3>
                <p className="text-gray-400">
                  Belum ada listing Primary/Secondary yang sesuai kriteria ini.
                </p>
                <button
                  onClick={() => router.push(BASE_URL)}
                  className="mt-6 px-6 py-2 bg-primary text-black font-bold rounded-full hover:bg-green-400 transition"
                >
                  Lihat Semua
                </button>
              </div>
            )}

            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPage={handlePageChange}
            />
          </div>

          {/* SIDEBAR DESKTOP */}
          <div className="hidden lg:block w-full lg:w-1/4 sticky top-32">
            <Sidebar />
          </div>
        </div>
      </div>

      {/* keyframes untuk animasi wiggle */}
      <style jsx global>{`
        @keyframes wiggle {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          25% {
            transform: translateY(-1px) rotate(-1deg);
          }
          75% {
            transform: translateY(1px) rotate(1deg);
          }
        }
      `}</style>
    </>
  );
};

export default ProductList;
