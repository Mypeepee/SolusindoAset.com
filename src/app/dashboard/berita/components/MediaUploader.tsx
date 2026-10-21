"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Crop, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { ArticleCover } from "./ArticleUI";
import { beritaRequest } from "./workspace";
import styles from "./workspace.module.css";

export default function MediaUploader({
  value,
  onChange,
  onBusyChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [uploading, setUploading] = useState(false);
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );
  const selectFile = (file?: File) => {
    if (!file) return;
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
        "image/gif",
      ].includes(file.type)
    ) {
      toast.error("Pilih gambar JPG, PNG, WebP, AVIF, atau GIF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 8 MB.");
      return;
    }
    setSource(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    onBusyChange(true);
  };
  const cancel = () => {
    setSource("");
    onBusyChange(false);
    input.current?.focus();
  };
  const upload = async () => {
    if (!area || uploading) return;
    setUploading(true);
    try {
      const image = new window.Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1920 / area.width);
      canvas.width = Math.round(area.width * scale);
      canvas.height = Math.round(area.height * scale);
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Browser tidak mendukung pemotongan gambar.");
      context.drawImage(
        image,
        area.x,
        area.y,
        area.width,
        area.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("Gagal memproses gambar.")),
          "image/webp",
          0.9,
        ),
      );
      const formData = new FormData();
      formData.append("image", blob, "cover.webp");
      const result = await beritaRequest<{ url: string }>(
        "/api/berita/upload",
        { method: "POST", body: formData },
      );
      onChange(result.url);
      setSource("");
      onBusyChange(false);
      toast.success("Gambar berhasil dipotong dan diunggah.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengunggah gambar.",
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className={styles.mediaUploader}>
      {source ? (
        <div className={styles.cropWorkspace}>
          <div className={styles.cropCanvas}>
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          </div>
          <label className={styles.cropZoom}>
            Perbesar
            <input
              aria-label="Perbesaran gambar"
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <div className={styles.cropControls}>
            <select
              aria-label="Rasio potong"
              value={aspect}
              onChange={(event) => setAspect(Number(event.target.value))}
            >
              <option value={16 / 9}>16:9</option>
              <option value={4 / 3}>4:3</option>
              <option value={1}>1:1</option>
            </select>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={cancel}
              disabled={uploading}
            >
              Batal
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={upload}
              disabled={uploading || !area}
            >
              {uploading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Crop size={13} />
              )}{" "}
              Simpan
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className={styles.uploadTarget}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectFile(event.dataTransfer.files[0]);
            }}
          >
            {value ? (
              <>
                <ArticleCover
                  src={value}
                  title="Gambar utama artikel"
                  sizes="320px"
                />
                <button
                  type="button"
                  className={styles.removeImage}
                  aria-label="Hapus gambar utama"
                  onClick={() => onChange("")}
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <button type="button" onClick={() => input.current?.click()}>
                <span className={styles.uploadIcon}>
                  <ImagePlus size={23} />
                </span>
                <strong>Tambahkan gambar utama</strong>
                <span>Tarik gambar ke sini atau pilih file</span>
                <small>JPG, PNG, WebP · maks. 8 MB</small>
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.uploadButton}
            onClick={() => input.current?.click()}
          >
            <Upload size={13} />
            {value ? "Ganti & potong gambar" : "Pilih gambar"}
          </button>
          <label className={styles.fieldLabel}>
            Atau gunakan URL gambar
            <input
              aria-label="URL gambar utama"
              type="url"
              maxLength={500}
              value={value}
              placeholder="https://…"
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
        </>
      )}
      <input
        className="sr-only"
        tabIndex={-1}
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        aria-label="Pilih file gambar utama"
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
