"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { DialogFrame } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import type { InvestorListing } from "@/lib/investor-deals";
type Item = { id: string; name: string };
type Options = {
  cityName: string;
  revision: string;
  districts: Item[];
  selectedDistrictId: string;
  kelurahan: Item[];
  currentKelurahan: string | null;
};
export default function LocationCorrectionDialog({
  listing,
  onClose,
  onSaved,
}: {
  listing: InvestorListing | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [options, setOptions] = useState<Options | null>(null),
    [district, setDistrict] = useState(""),
    [kel, setKel] = useState("");
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [conflict, setConflict] = useState(false);
  const revision = useRef("");
  const select = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    revision.current = "";
    setOptions(null);
    setDistrict("");
    setKel("");
    setError("");
    setConflict(false);
  }, [listing?.id]);
  useEffect(() => {
    if (!listing) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    setError("");
    fetch(
      `/api/dashboard/investor/${listing.id}/location${district ? `?districtId=${encodeURIComponent(district)}` : ""}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok)
          throw new Error(body.error || "Pilihan wilayah belum tersedia.");
        return body as Options;
      })
      .then((body) => {
        if (!active) return;
        if (revision.current && revision.current !== body.revision) {
          setConflict(true);
          setError(
            "Lokasi listing sudah berubah. Muat ulang sebelum menyimpan.",
          );
          return;
        }
        revision.current = body.revision;
        setOptions(body);
        if (!district && body.selectedDistrictId)
          setDistrict(body.selectedDistrictId);
      })
      .catch((err) => {
        if (active)
          setError(
            err.name === "AbortError"
              ? "Referensi wilayah terlalu lama merespons. Coba lagi."
              : err.message,
          );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [listing?.id, district, attempt]);
  const reload = () => {
    revision.current = "";
    setConflict(false);
    setOptions(null);
    setDistrict("");
    setKel("");
    setAttempt((v) => v + 1);
  };
  const save = async () => {
    if (!listing || saving) return;
    if (!district || !kel) {
      setError("Pilih kecamatan dan kelurahan.");
      select.current?.focus();
      return;
    }
    setSaving(true);
    setError("");
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(
        `/api/dashboard/investor/${listing.id}/location`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            districtId: district,
            kelurahanId: kel,
            revision: revision.current,
          }),
          signal: controller.signal,
        },
      );
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) setConflict(true);
        throw new Error(body.error || "Lokasi belum dapat disimpan.");
      }
      toast.success("Kelurahan disimpan. Analisis diperbarui.");
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error && err.name !== "AbortError"
          ? err.message
          : "Permintaan melewati batas waktu. Muat ulang untuk memeriksa hasil penyimpanan.",
      );
    } finally {
      clearTimeout(timeout);
      setSaving(false);
    }
  };
  return (
    <DialogFrame
      open={Boolean(listing)}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      title="Verifikasi kelurahan"
      description="Pilih wilayah yang sesuai dengan alamat sumber. Hanya OWNER aktif dapat menyimpan koreksi."
      contentClassName="investor-surface investor-dialog"
      overlayClassName="investor-dialog-overlay"
      closeClassName="investor-dialog-close"
      focusFallbackId="investor-heading"
    >
      <div className="border-b border-white/10 p-6 pr-14">
        <p className="flex items-center gap-2 text-xs text-emerald-200">
          <MapPin size={15} /> Verifikasi lokasi
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Pilih kelurahan
        </h2>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          {listing?.title}
        </p>
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4 p-6"
      >
        <p className="text-xs leading-5 text-slate-400">
          {listing?.address || "Alamat rinci belum tersedia"} ·{" "}
          {options?.cityName || listing?.cityName}
        </p>
        <div>
          <label
            htmlFor="investor-correction-district"
            className="mb-2 block text-xs text-slate-300"
          >
            Kecamatan
          </label>
          <Select
            focusTone="neutral"
            id="investor-correction-district"
            disabled={saving || loading || conflict}
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setKel("");
            }}
          >
            <option value="">Pilih kecamatan</option>
            {options?.districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label
            htmlFor="investor-correction-kel"
            className="mb-2 block text-xs text-slate-300"
          >
            Kelurahan
          </label>
          <Select
            focusTone="neutral"
            ref={select}
            id="investor-correction-kel"
            disabled={!district || saving || loading || conflict}
            value={kel}
            aria-invalid={Boolean(error) && !kel}
            aria-describedby="investor-correction-feedback"
            onChange={(e) => {
              setKel(e.target.value);
              setError("");
            }}
          >
            <option value="">Pilih kelurahan</option>
            {options?.kelurahan.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </Select>
        </div>
        <div
          id="investor-correction-feedback"
          className="min-h-[44px] text-xs leading-5"
        >
          {loading ? (
            <p role="status" className="flex items-center gap-2 text-slate-300">
              <Loader2
                size={14}
                className="animate-spin motion-reduce:animate-none"
              />{" "}
              Memuat referensi wilayah…
            </p>
          ) : error ? (
            <p role="alert" className="text-amber-200">
              {error}
            </p>
          ) : (
            <p className="text-slate-400">
              Pilihan diverifikasi terhadap kota dan kecamatan. Koreksi hanya
              mengubah lokasi listing ini.
            </p>
          )}
        </div>
        {(conflict || error) && (
          <button
            type="button"
            className="investor-button text-xs"
            onClick={reload}
            disabled={saving}
          >
            <RefreshCw size={14} /> Muat ulang pilihan
          </button>
        )}
        <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            className="investor-button"
            disabled={saving}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="submit"
            className="investor-primary min-w-[150px]"
            disabled={saving || loading || conflict || !district || !kel}
            aria-busy={saving}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Menyimpan…
              </>
            ) : (
              "Simpan kelurahan"
            )}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
