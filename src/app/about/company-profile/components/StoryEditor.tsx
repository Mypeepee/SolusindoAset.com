"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  ImagePlus,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DialogFrame } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_STORY_IMAGES,
  MAX_STORY_IMAGE_BYTES,
  STORY_IMAGE_TYPES,
  formatStoryPrice,
  type SuccessStory,
} from "@/lib/success-stories";

import { successStorySchema } from "@/lib/success-story-schema";

type Photo = {
  id: string;
  file: File;
  preview: string;
  url?: string;
  status: "uploading" | "ready" | "error";
  error?: string;
};
type StoryForm = SuccessStory;
const primary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full bg-emerald-300 px-4 text-[13px] font-bold text-[#06110e] transition-colors hover:bg-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 px-5 text-sm text-white/80 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:opacity-50";

export default function StoryEditor({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (story: SuccessStory) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [serverError, setServerError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [dragging, setDragging] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const objectUrls = useRef(new Set<string>());
  const mounted = useRef(true);
  const removedPhotos = useRef(new Set<string>());
  const submitLock = useRef(false);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isDirty, isSubmitting, isSubmitted },
  } = useForm<StoryForm>({
    resolver: zodResolver(successStorySchema),
    mode: "onBlur",
    shouldFocusError: false,
    defaultValues: {
      id: crypto.randomUUID(),
      title: "",
      location: "",
      type: "Aset Lelang",
      desc: "",
      marketPrice: 0,
      dealPrice: 0,
      images: [],
      tiktokUrl: "",
    },
  });
  const values = watch();
  const uploading = photos.some((photo) => photo.status === "uploading");
  const failed = photos.some((photo) => photo.status === "error");
  const dirty = isDirty || photos.length > 0;

  useEffect(() => {
    mounted.current = true;
    const requests = controllers.current;
    const urls = objectUrls.current;
    return () => {
      mounted.current = false;
      requests.forEach((controller) => controller.abort());
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    setValue(
      "images",
      photos
        .filter((photo) => photo.status === "ready" && photo.url)
        .map((photo) => photo.url!),
      { shouldValidate: photos.length > 0 || isSubmitted },
    );
  }, [photos, setValue, isSubmitted]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function requestClose() {
    if (isSubmitting || submitLock.current) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  async function upload(photo: Photo) {
    if (!mounted.current || removedPhotos.current.has(photo.id)) return;
    const controller = new AbortController();
    controllers.current.set(photo.id, controller);
    setPhotos((current) =>
      current.map((item) =>
        item.id === photo.id
          ? { ...item, status: "uploading", error: undefined }
          : item,
      ),
    );
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
      const body = new FormData();
      body.append("image", photo.file);
      const response = await fetch("/api/about/stories/images", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || !result.url)
        throw new Error(result.error || "Foto belum terunggah.");
      setPhotos((current) =>
        current.map((item) =>
          item.id === photo.id
            ? { ...item, status: "ready", url: result.url }
            : item,
        ),
      );
    } catch (error) {
      setPhotos((current) =>
        current.map((item) =>
          item.id === photo.id
            ? {
                ...item,
                status: "error",
                error:
                  error instanceof Error && error.name !== "AbortError"
                    ? error.message
                    : "Unggahan terhenti. Coba lagi.",
              }
            : item,
        ),
      );
    } finally {
      clearTimeout(timeout);
      controllers.current.delete(photo.id);
    }
  }

  async function addPhotos(files: FileList | File[]) {
    setPhotoError("");
    const selected = Array.from(files);
    if (photos.length + selected.length > MAX_STORY_IMAGES) {
      setPhotoError(
        "Maksimal 6 foto. Pilih lebih sedikit atau hapus foto yang tidak digunakan.",
      );
      return;
    }
    if (
      selected.some(
        (file) =>
          !STORY_IMAGE_TYPES.includes(file.type) ||
          file.size > MAX_STORY_IMAGE_BYTES ||
          !file.size,
      )
    ) {
      setPhotoError(
        "Gunakan JPG, PNG, WebP, atau AVIF, maksimal 8 MB per foto.",
      );
      return;
    }
    const added: Photo[] = selected.map((file) => {
      const preview = URL.createObjectURL(file);
      objectUrls.current.add(preview);
      return { id: crypto.randomUUID(), file, preview, status: "uploading" };
    });
    setPhotos((current) => [...current, ...added]);
    // At most two uploads at once; typing and local previews remain immediate.
    let index = 0;
    const worker = async () => {
      while (index < added.length && mounted.current) {
        const photo = added[index++];
        await upload(photo);
      }
    };
    await Promise.all([worker(), worker()]);
  }

  function removePhoto(photo: Photo) {
    removedPhotos.current.add(photo.id);
    controllers.current.get(photo.id)?.abort();
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    URL.revokeObjectURL(photo.preview);
    objectUrls.current.delete(photo.preview);
  }

  async function save(data: StoryForm) {
    if (submitLock.current || uploading || failed) return;
    submitLock.current = true;
    setServerError("");
    try {
      const response = await fetch("/api/about/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.fields)
          for (const [field, messages] of Object.entries(result.fields))
            setError(
              field as keyof StoryForm,
              { message: (messages as string[])[0] },
              { shouldFocus: true },
            );
        throw new Error(
          result.error || "Proyek belum tersimpan. Silakan coba lagi.",
        );
      }
      onSaved(result.story);
      toast.success("Proyek selesai berhasil ditambahkan.");
    } catch (error) {
      setServerError(
        error instanceof Error &&
          error.name !== "TimeoutError" &&
          error.name !== "TypeError"
          ? error.message
          : "Koneksi terputus atau terlalu lama. Data tetap ada; coba simpan kembali.",
      );
    } finally {
      submitLock.current = false;
    }
  }

  function fieldError(name: keyof StoryForm) {
    const message = errors[name]?.message;
    return message ? (
      <p
        id={`story-${name}-error`}
        className="mt-1.5 text-xs text-rose-300"
        role="alert"
      >
        {String(message)}
      </p>
    ) : null;
  }
  const fieldA11y = (name: keyof StoryForm) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `story-${name}-error` : undefined,
  });

  return (
    <>
      <DialogFrame
        open
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
        title="Tambah proyek selesai"
        description="Unggah foto dan dokumentasikan hasil proyek yang sudah diserahterimakan."
        hideClose
        focusFallbackId="add-success-story"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
              <ShieldCheck size={13} /> Owner
            </span>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              Tambah proyek selesai
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-white/50 sm:text-sm">
              Dokumentasi nyata, dari proses hingga serah terima.
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup formulir"
            onClick={requestClose}
            disabled={isSubmitting}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-white/60 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>
        <form
          noValidate
          onSubmit={handleSubmit(save, (invalid) => {
            const field = (
              [
                "images",
                "title",
                "location",
                "type",
                "desc",
                "marketPrice",
                "dealPrice",
                "tiktokUrl",
              ] as const
            ).find((name) => invalid[name]);
            if (field)
              document
                .getElementById(
                  field === "images" ? "story-photos" : `story-${field}`,
                )
                ?.focus();
          })}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div
            className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7"
            style={{ scrollbarGutter: "stable" }}
          >
            {serverError && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-200"
              >
                {serverError}
              </div>
            )}
            <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 space-y-5">
                <section aria-labelledby="story-photos-heading">
                  <div className="mb-2 flex items-center justify-between">
                    <h3
                      id="story-photos-heading"
                      className="text-sm font-semibold"
                    >
                      Foto proyek
                    </h3>
                    <span className="text-xs tabular-nums text-white/40">
                      {photos.length}/6 foto
                    </span>
                  </div>
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!isSubmitting) setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      if (!isSubmitting)
                        void addPhotos(event.dataTransfer.files);
                    }}
                    className={`rounded-xl border border-dashed transition-colors ${dragging ? "border-emerald-300 bg-emerald-300/10" : "border-white/20 bg-white/[0.02]"}`}
                  >
                    <label
                      htmlFor="story-photos"
                      className="flex cursor-pointer items-center gap-3 p-4 focus-within:ring-2 focus-within:ring-emerald-300"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300">
                        <ImagePlus size={20} />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">
                          Pilih foto atau tarik ke sini
                        </span>
                        <span
                          id="story-photo-help"
                          className="mt-1 block text-[11px] leading-relaxed text-white/45"
                        >
                          JPG, PNG, WebP, AVIF · Maks. 8 MB/foto · Foto pertama
                          menjadi sampul.
                        </span>
                      </span>
                      <input
                        id="story-photos"
                        type="file"
                        multiple
                        accept={STORY_IMAGE_TYPES.join(",")}
                        disabled={
                          isSubmitting || photos.length >= MAX_STORY_IMAGES
                        }
                        aria-invalid={!!errors.images}
                        aria-describedby={
                          errors.images
                            ? "story-photo-help story-images-error"
                            : "story-photo-help"
                        }
                        className="sr-only"
                        onChange={(event) => {
                          if (event.target.files)
                            void addPhotos(event.target.files);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <AnimatePresence initial={false}>
                      {photos.map((photo, index) => (
                        <motion.div
                          key={photo.id}
                          initial={
                            reduceMotion ? false : { opacity: 0, scale: 0.96 }
                          }
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.18 }}
                          className="relative min-w-0"
                        >
                          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-white/5">
                            {/* Object URLs give an immediate local preview, before upload. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.preview}
                              alt={`Foto proyek ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              aria-label={`Hapus foto ${index + 1}`}
                              onClick={() => removePhoto(photo)}
                              disabled={isSubmitting}
                              className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-white hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
                            >
                              <X size={13} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Jadikan foto ${index + 1} sebagai sampul`}
                              onClick={() =>
                                setPhotos((current) => [
                                  current[index],
                                  ...current.filter((_, i) => i !== index),
                                ])
                              }
                              disabled={isSubmitting || index === 0}
                              className="absolute bottom-1 left-1 inline-flex min-h-6 items-center gap-1 rounded-md bg-black/75 px-1.5 text-[9px] text-white disabled:text-emerald-300"
                            >
                              <Star size={10} />
                              {index === 0 ? "Sampul" : "Jadi sampul"}
                            </button>
                            {photo.status === "uploading" && (
                              <span className="absolute bottom-1 right-1 rounded-full bg-black/75 p-1 text-emerald-300">
                                <Loader2 size={12} className="animate-spin" />
                              </span>
                            )}
                            {photo.status === "ready" && (
                              <span className="absolute bottom-1 right-1 rounded-full bg-black/75 p-1 text-emerald-300">
                                <Check size={12} />
                              </span>
                            )}
                          </div>
                          <p
                            className="mt-1 truncate text-[9px] text-white/40"
                            title={photo.file.name}
                          >
                            {photo.file.name}
                          </p>
                          {photo.status === "error" && (
                            <div
                              role="alert"
                              className="mt-1 text-[10px] text-rose-300"
                            >
                              <p>{photo.error}</p>
                              <button
                                type="button"
                                onClick={() => void upload(photo)}
                                className="inline-flex min-h-7 items-center gap-1 underline"
                              >
                                <RotateCcw size={10} />
                                Coba lagi
                              </button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  <p className="mt-1 text-[11px] text-white/45" role="status">
                    {uploading
                      ? "Mengunggah foto… Anda bisa melanjutkan mengisi detail."
                      : photos.length
                        ? `${photos.filter((photo) => photo.status === "ready").length} foto siap digunakan.`
                        : "Tambahkan minimal satu foto."}
                  </p>
                  {(photoError || (!uploading && errors.images)) && (
                    <p
                      id="story-images-error"
                      role="alert"
                      className="mt-2 text-xs text-rose-300"
                    >
                      {photoError ||
                        String(
                          errors.images?.message ||
                            "Periksa kembali foto proyek.",
                        )}
                    </p>
                  )}
                </section>
                <div>
                  <Label htmlFor="story-title">Nama proyek</Label>
                  <Input
                    id="story-title"
                    placeholder="Nama properti atau proyek"
                    maxLength={120}
                    {...register("title")}
                    {...fieldA11y("title")}
                  />
                  {fieldError("title")}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="story-location">Lokasi</Label>
                    <Input
                      id="story-location"
                      placeholder="Kota, Provinsi"
                      maxLength={120}
                      {...register("location")}
                      {...fieldA11y("location")}
                    />
                    {fieldError("location")}
                  </div>
                  <div>
                    <Label htmlFor="story-type">Kategori</Label>
                    <Input
                      id="story-type"
                      maxLength={60}
                      {...register("type")}
                      {...fieldA11y("type")}
                    />
                    {fieldError("type")}
                  </div>
                </div>
                <div>
                  <Label htmlFor="story-desc">Cerita keberhasilan</Label>
                  <Textarea
                    id="story-desc"
                    placeholder="Ceritakan proses, hasil, dan serah terima proyek."
                    maxLength={1000}
                    rows={4}
                    className="resize-none"
                    {...register("desc")}
                    {...fieldA11y("desc")}
                  />
                  {fieldError("desc")}
                  <p className="mt-1 text-right text-[10px] tabular-nums text-white/35">
                    {values.desc.length}/1.000
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["marketPrice", "Harga pasaran"],
                      ["dealPrice", "Harga deal"],
                    ] as const
                  ).map(([name, label]) => (
                    <div key={name}>
                      <Label htmlFor={`story-${name}`}>{label}</Label>
                      <Input
                        id={`story-${name}`}
                        inputMode="numeric"
                        placeholder="Rupiah"
                        value={
                          values[name]
                            ? values[name].toLocaleString("id-ID")
                            : ""
                        }
                        onChange={(event) =>
                          setValue(
                            name,
                            Number(event.target.value.replace(/\D/g, "")),
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                        {...fieldA11y(name)}
                      />
                      <span className="mt-1 block text-[10px] text-white/35">
                        Dalam Rupiah
                      </span>
                      {fieldError(name)}
                    </div>
                  ))}
                </div>
                <div>
                  <Label htmlFor="story-tiktokUrl">
                    Tautan TikTok{" "}
                    <span className="font-normal text-white/40">
                      (opsional)
                    </span>
                  </Label>
                  <Input
                    id="story-tiktokUrl"
                    type="url"
                    inputMode="url"
                    placeholder="https://www.tiktok.com/…"
                    {...register("tiktokUrl")}
                    {...fieldA11y("tiktokUrl")}
                  />
                  {fieldError("tiktokUrl")}
                </div>
              </div>
              <aside className="hidden lg:block">
                <div className="sticky top-0">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                    Pratinjau langsung
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-emerald-400/15 bg-[#080d14]">
                    <div className="relative aspect-[4/3] bg-emerald-400/5">
                      {photos[0] ? (
                        <img
                          src={photos[0].preview}
                          alt="Pratinjau sampul"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-emerald-300/25">
                          <ImagePlus size={40} />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] text-emerald-300">
                        {values.location || "Lokasi proyek"}
                      </p>
                      <h3 className="mt-2 break-words text-lg font-bold leading-snug">
                        {values.title || "Nama proyek"}
                      </h3>
                      <p className="mt-2 break-words text-xs leading-relaxed text-white/55">
                        {values.desc ||
                          "Cerita hasil proyek akan tampil di sini."}
                      </p>
                      {values.dealPrice > 0 && (
                        <p className="mt-4 border-t border-white/10 pt-3 text-sm font-bold text-emerald-300">
                          Deal {formatStoryPrice(values.dealPrice)}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-white/35">
                    <ArrowUpRight size={14} className="shrink-0" />
                    Proyek langsung tampil di halaman Tentang Kami setelah
                    disimpan.
                  </p>
                </div>
              </aside>
            </div>
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#0b1018] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
            <button
              type="button"
              onClick={requestClose}
              disabled={isSubmitting}
              className={secondary}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploading || failed}
              aria-busy={isSubmitting}
              className={`${primary} w-[190px] shrink-0`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menyimpan…
                </>
              ) : uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menyiapkan foto…
                </>
              ) : (
                <>
                  <Check size={16} />
                  Simpan & tampilkan
                </>
              )}
            </button>
          </footer>
        </form>
      </DialogFrame>
      <DialogFrame
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Tutup tanpa menyimpan?"
        description="Data proyek yang belum disimpan akan hilang."
        hideClose
      >
        <div className="p-6 sm:p-8">
          <h2 className="text-xl font-bold">Tutup tanpa menyimpan?</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Data proyek belum tersimpan. Anda bisa melanjutkan mengisi atau
            menutup formulir.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className={primary}
              onClick={() => setConfirmClose(false)}
            >
              Lanjut mengisi
            </button>
            <button type="button" className={secondary} onClick={onClose}>
              Tutup tanpa menyimpan
            </button>
          </div>
        </div>
      </DialogFrame>
    </>
  );
}
