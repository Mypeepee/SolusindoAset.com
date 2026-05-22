"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Loader2,
  MapPin,
  Search,
  ScanLine,
  Shield,
  TriangleAlert,
  User2,
  Users,
  X,
  Link2,
} from "lucide-react";
import { ocrKTP } from "@/lib/ocrKtp";

// ── Types ─────────────────────────────────────────────────────────────────────

export type KlienData = {
  id_klien: string | null;
  nama_klien: string;
  nik_klien: string;
  alamat_klien: string;
};

type ScanStatus = "idle" | "valid" | "review" | "invalid";

type UserOption = {
  id_pengguna: string;
  nama_lengkap: string;
  nomor_telepon: string | null;
  email: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// ── KTP Dropzone (compact) ────────────────────────────────────────────────────

function KtpDropzone({
  filename,
  loading,
  status,
  onFile,
}: {
  filename?: string;
  loading?: boolean;
  status?: ScanStatus;
  onFile: (f: File) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const hasFile = Boolean(filename);

  const handleRaw = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Ukuran file maksimal 10 MB."); return; }
    await onFile(file);
  };

  const stateClass = loading
    ? "border-zinc-800/70 bg-zinc-900/40 opacity-80"
    : dragging
    ? "border-emerald-400/90 bg-emerald-500/[0.08] shadow-[0_0_60px_rgba(16,185,129,0.22)]"
    : hasFile && status !== "invalid"
    ? "border-emerald-500/55 bg-emerald-500/[0.05] shadow-[0_0_30px_rgba(16,185,129,0.11)]"
    : "border-zinc-800/70 bg-zinc-900/40 hover:border-emerald-500/55 hover:bg-emerald-500/[0.04] hover:shadow-[0_0_40px_rgba(16,185,129,0.13)]";

  return (
    <div
      className={cx(
        "group relative cursor-pointer select-none rounded-2xl border border-dashed transition-all duration-300",
        stateClass
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void handleRaw(e.dataTransfer.files?.[0]); }}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.05) 0%, transparent 70%)" }}
      />

      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
        <div className={cx(
          "grid h-14 w-14 place-items-center rounded-2xl transition-all duration-300",
          "bg-emerald-500/12 ring-1 ring-emerald-500/30",
          dragging && "scale-110"
        )}>
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          ) : hasFile && status !== "invalid" ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          ) : (
            <ScanLine className="h-6 w-6 text-emerald-400 transition-all duration-300 group-hover:scale-110" />
          )}
        </div>

        <div className="space-y-1">
          <p className="text-[14px] font-bold text-white">
            {hasFile && status !== "invalid" ? "KTP Berhasil Dipindai" : "Upload Foto KTP Klien"}
          </p>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            {loading
              ? "Menganalisis dokumen KTP…"
              : hasFile && status !== "invalid"
              ? "Data telah diekstrak otomatis — periksa di bawah"
              : "Sistem akan membaca nama, NIK, dan alamat secara otomatis"}
          </p>
        </div>

        {hasFile ? (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 shrink-0" />
            <span className="truncate max-w-[180px]">{filename}</span>
          </div>
        ) : !loading ? (
          <>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-400/25">
              JPG / PNG / WEBP
            </span>
            <p className="text-[10px] text-zinc-600 transition-colors group-hover:text-zinc-500">
              {dragging ? "Lepaskan file di sini" : "Klik atau seret & lepas · Maks. 10 MB"}
            </p>
          </>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { void handleRaw(e.target.files?.[0]); e.currentTarget.value = ""; }}
      />
    </div>
  );
}

// ── Scan status badge ─────────────────────────────────────────────────────────

function ScanBadge({ status, conf }: { status: ScanStatus; conf: number }) {
  if (status === "idle") return null;
  const map: Record<ScanStatus, { label: string; cls: string }> = {
    idle:    { label: "", cls: "" },
    valid:   { label: `Terverifikasi · ${conf}%`,   cls: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25" },
    review:  { label: `Perlu Diperiksa · ${conf}%`, cls: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/25" },
    invalid: { label: "Gagal Memindai",              cls: "bg-red-500/10 text-red-300 ring-1 ring-red-500/25" },
  };
  const { label, cls } = map[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cls)}>
      {status === "invalid" ? <TriangleAlert className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
      {label}
    </span>
  );
}

// ── Field input ───────────────────────────────────────────────────────────────

function FieldInput({
  label, value, onChange, placeholder, icon, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon?: ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{label}</label>
      <div className="flex items-start overflow-hidden rounded-xl bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] focus-within:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.40)] transition-shadow duration-200">
        {icon && (
          <div className="flex h-10 w-9 shrink-0 items-center justify-center border-r border-white/[0.06] text-zinc-500">
            {icon}
          </div>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600"
        />
      </div>
      {hint && <p className="text-[10px] text-zinc-600">{hint}</p>}
    </div>
  );
}

function FieldTextarea({
  label, value, onChange, placeholder, icon,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{label}</label>
      <div className="flex items-start overflow-hidden rounded-xl bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] focus-within:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.40)] transition-shadow duration-200">
        {icon && (
          <div className="flex h-10 w-9 shrink-0 items-center justify-center border-r border-white/[0.06] text-zinc-500">
            <div className="mt-2.5">{icon}</div>
          </div>
        )}
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600"
        />
      </div>
    </div>
  );
}

// ── Avatar dengan inisial hijau ───────────────────────────────────────────────

function UserAvatar({ nama, size = "md" }: { nama: string; size?: "sm" | "md" }) {
  const initials = getInitials(nama);
  const dim = size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-[12px]";
  return (
    <div
      className={cx(
        "shrink-0 flex items-center justify-center rounded-full font-black",
        dim,
      )}
      style={{
        background: "linear-gradient(135deg, #059669 0%, #10b981 60%, #34d399 100%)",
        boxShadow: "0 0 12px rgba(16,185,129,0.35)",
      }}
    >
      <span className="text-white drop-shadow-sm">{initials}</span>
    </div>
  );
}

// ── User dropdown (compact, untuk id_klien opsional) ─────────────────────────

function UserDropdown({
  value, options, onSelect, loading,
}: {
  value: UserOption | null;
  options: UserOption[];
  onSelect: (u: UserOption | null) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef    = useRef<HTMLButtonElement | null>(null);
  const panelRef  = useRef<HTMLDivElement | null>(null);
  const inputRef  = useRef<HTMLInputElement | null>(null);

  function computePos() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }

  useEffect(() => {
    if (!open) return;
    computePos();
    setTimeout(() => inputRef.current?.focus(), 60);
    const onScroll = () => computePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", computePos);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", computePos);
    };
  }, [open]);

  // Tutup jika klik di luar trigger DAN panel
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      const insideBtn   = btnRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideBtn && !insidePanel) { setOpen(false); setKeyword(""); }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setKeyword(""); }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return options;
    return options.filter((u) =>
      `${u.nama_lengkap} ${u.nomor_telepon ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q)
    );
  }, [keyword, options]);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        disabled={loading}
        onClick={() => { if (!loading) { computePos(); setOpen((v) => !v); } }}
        className={cx(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200",
          loading ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          "bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]",
          open
            ? "shadow-[inset_0_0_0_1.5px_rgba(16,185,129,0.50)]"
            : "hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
        )}
      >
        {value ? (
          <>
            <UserAvatar nama={value.nama_lengkap} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-white">{value.nama_lengkap}</div>
              <div className="truncate text-[11px] text-emerald-400/70">
                {value.nomor_telepon ?? value.email ?? value.id_pengguna}
              </div>
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-zinc-500 hover:bg-red-500/15 hover:text-red-400 transition"
            >
              <X size={10} />
            </button>
          </>
        ) : (
          <>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800">
              {loading
                ? <Loader2 size={14} className="animate-spin text-zinc-400" />
                : <Users size={14} className="text-zinc-500" />}
            </div>
            <span className="text-[13px] text-zinc-500">
              {loading ? "Memuat pengguna…" : "Cari & pilih pengguna…"}
            </span>
            <ChevronDown size={13} className={cx("ml-auto shrink-0 text-zinc-600 transition-transform duration-200", open && "rotate-180")} />
          </>
        )}
      </button>

      {/* Dropdown panel via portal — fix bug: ref dipakai untuk exclude dari mousedown */}
      {open && !loading && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className="absolute overflow-hidden rounded-xl bg-[#0c100f] shadow-[0_20px_60px_rgba(0,0,0,0.80),inset_0_1px_0_rgba(255,255,255,0.04)]"
          style={{ top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, position: "fixed" }}
        >
          {/* Search */}
          <div className="p-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.20)]">
              <Search size={12} className="shrink-0 text-emerald-500/70" />
              <input
                ref={inputRef}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Cari nama, telepon, email…"
                className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-zinc-600"
              />
              {keyword && (
                <button type="button" onClick={() => setKeyword("")} className="shrink-0 text-zinc-600 hover:text-zinc-400">
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto p-1.5" style={{ scrollbarWidth: "none" }}>
            {filtered.length > 0 ? (
              <div className="space-y-0.5">
                {filtered.map((u) => {
                  const sel = value?.id_pengguna === u.id_pengguna;
                  return (
                    <button
                      key={u.id_pengguna}
                      type="button"
                      onMouseDown={(e) => {
                        // Gunakan mousedown untuk select agar tidak bentrok dengan close listener
                        e.preventDefault();
                        onSelect(u);
                        setOpen(false);
                        setKeyword("");
                      }}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                        sel
                          ? "bg-emerald-500/12 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.22)]"
                          : "hover:bg-white/[0.05]",
                      )}
                    >
                        <UserAvatar nama={u.nama_lengkap} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className={cx("truncate text-[13px] font-semibold", sel ? "text-emerald-100" : "text-white")}>
                            {u.nama_lengkap}
                          </div>
                          <div className={cx("truncate text-[11px]", sel ? "text-emerald-400/70" : "text-zinc-500")}>
                            {u.nomor_telepon ?? u.email ?? u.id_pengguna}
                          </div>
                        </div>
                        {sel && (
                          <div className="shrink-0 grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20">
                            <CheckCircle2 size={12} className="text-emerald-400" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-[12px] text-zinc-600">Tidak ada pengguna ditemukan</p>
                  {keyword && (
                    <button type="button" onClick={() => setKeyword("")} className="mt-2 text-[11px] text-emerald-500/70 hover:text-emerald-400">
                      Hapus filter
                    </button>
                  )}
                </div>
              )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Inline user picker — list langsung muncul saat accordion dibuka ──────────

function InlineUserPicker({
  value, options, loading, onSelect,
}: {
  value: UserOption | null;
  options: UserOption[];
  loading: boolean;
  onSelect: (u: UserOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return options;
    return options.filter((u) =>
      `${u.nama_lengkap} ${u.nomor_telepon ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q)
    );
  }, [keyword, options]);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02]">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => { open ? setOpen(false) : handleOpen(); }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <div className={cx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors duration-200",
          value ? "bg-emerald-500/15 ring-emerald-500/30" : "bg-white/[0.05] ring-white/[0.08]",
        )}>
          <Link2 size={13} className={value ? "text-emerald-400" : "text-zinc-500"} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-zinc-300">Hubungkan ke akun pengguna</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-500">Opsional</span>
          </div>
          <p className="text-[11px] text-zinc-600">
            {value ? `Terhubung: ${value.nama_lengkap}` : "Jika klien sudah punya akun di aplikasi"}
          </p>
        </div>

        <ChevronDown
          size={14}
          className={cx("shrink-0 text-zinc-600 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-white/[0.05]">
          {/* Jika sudah ada value — tampilkan chip + opsi ganti */}
          {value && (
            <div className="flex items-center gap-3 border-b border-white/[0.04] px-4 py-2.5">
              <UserAvatar nama={value.nama_lengkap} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-emerald-100">{value.nama_lengkap}</p>
                <p className="truncate text-[11px] text-emerald-400/60">{value.nomor_telepon ?? value.email ?? value.id_pengguna}</p>
              </div>
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="shrink-0 flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/15 transition"
              >
                <X size={10} />
                Hapus
              </button>
            </div>
          )}

          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]">
              <Search size={13} className="shrink-0 text-emerald-500/60" />
              <input
                ref={inputRef}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Cari nama, telepon, atau email…"
                className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-zinc-600"
              />
              {keyword && (
                <button type="button" onClick={() => setKeyword("")} className="shrink-0 text-zinc-600 hover:text-zinc-400">
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: "none" }}>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 size={14} className="animate-spin text-zinc-500" />
                <span className="text-[12px] text-zinc-600">Memuat pengguna…</span>
              </div>
            ) : filtered.length > 0 ? (
              <div className="space-y-0.5">
                {filtered.map((u) => {
                  const sel = value?.id_pengguna === u.id_pengguna;
                  return (
                    <button
                      key={u.id_pengguna}
                      type="button"
                      onClick={() => { onSelect(u); setOpen(false); setKeyword(""); }}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150",
                        sel
                          ? "bg-emerald-500/12 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]"
                          : "hover:bg-white/[0.05]",
                      )}
                    >
                      <UserAvatar nama={u.nama_lengkap} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className={cx("truncate text-[13px] font-semibold", sel ? "text-emerald-100" : "text-white")}>
                          {u.nama_lengkap}
                        </p>
                        <p className={cx("truncate text-[11px]", sel ? "text-emerald-400/60" : "text-zinc-500")}>
                          {u.nomor_telepon ?? u.email ?? u.id_pengguna}
                        </p>
                      </div>
                      {sel && (
                        <div className="shrink-0 grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20">
                          <CheckCircle2 size={12} className="text-emerald-400" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-[12px] text-zinc-600">Tidak ada pengguna ditemukan</p>
                {keyword && (
                  <button type="button" onClick={() => setKeyword("")} className="mt-1.5 text-[11px] text-emerald-500/70 hover:text-emerald-400">
                    Hapus filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TabKlien({
  initialData,
  onNext,
  onDataChange,
  onKtpFile,
}: {
  initialData?: KlienData;
  onNext?: () => void;
  onDataChange?: (data: KlienData) => void;
  onKtpFile?: (file: File | null) => void;
}) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);

  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [ktpFilename, setKtpFilename] = useState("");
  const [ktpLoading, setKtpLoading] = useState(false);
  const [ktpStatus, setKtpStatus] = useState<ScanStatus>("idle");
  const [ktpConf, setKtpConf] = useState(0);
  const [ktpWarns, setKtpWarns] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const [nama, setNama] = useState(initialData?.nama_klien ?? "");
  const [nik, setNik] = useState(initialData?.nik_klien ?? "");
  const [alamat, setAlamat] = useState(initialData?.alamat_klien ?? "");

  const [showLinkUser, setShowLinkUser] = useState(false);

  const onDataChangeRef = useRef(onDataChange);
  useEffect(() => { onDataChangeRef.current = onDataChange; }, [onDataChange]);

  const selectedUserRef = useRef(selectedUser);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  function emit(patch: { id_klien?: string | null; nama_klien?: string; nik_klien?: string; alamat_klien?: string }) {
    onDataChangeRef.current?.({
      id_klien: selectedUserRef.current?.id_pengguna ?? null,
      nama_klien: nama,
      nik_klien: nik,
      alamat_klien: alamat,
      ...patch,
    });
  }

  useEffect(() => {
    fetch("/api/closing/users")
      .then((r) => r.json())
      .then((j) => { if (j.ok && Array.isArray(j.users)) setUsers(j.users); })
      .catch(console.error)
      .finally(() => setUsersLoading(false));
  }, []);

  function handleSelectUser(u: UserOption | null) {
    setSelectedUser(u);
    selectedUserRef.current = u;
    if (u && !nama.trim()) {
      setNama(u.nama_lengkap);
      emit({ id_klien: u.id_pengguna, nama_klien: u.nama_lengkap });
    } else {
      emit({ id_klien: u?.id_pengguna ?? null });
    }
  }

  async function handleKtpFile(file: File) {
    setKtpFile(file);
    onKtpFile?.(file);
    setKtpLoading(true);
    setErrorMsg("");
    setKtpStatus("idle");
    setKtpFilename(file.name);

    try {
      const ocr = await ocrKTP(file);
      const p = ocr.parsed as any;
      const newNama   = String(p.nama ?? "");
      const newNik    = String(p.nik  ?? "");
      const newAlamat = String(p.alamat_lengkap ?? "");

      setNama(newNama);
      setNik(newNik);
      setAlamat(newAlamat);
      setKtpStatus(ocr.status);
      setKtpConf(Math.round(ocr.confidence));
      setKtpWarns(ocr.warnings ?? []);
      if (ocr.warnings?.length) setErrorMsg(ocr.warnings[0]);

      onDataChangeRef.current?.({
        id_klien: selectedUserRef.current?.id_pengguna ?? null,
        nama_klien: newNama,
        nik_klien: newNik,
        alamat_klien: newAlamat,
      });
    } catch {
      setKtpFile(null);
      onKtpFile?.(null);
      setKtpStatus("invalid");
      setKtpFilename("");
      setErrorMsg("Gagal membaca KTP. Pastikan foto jelas dan tidak buram.");
    } finally {
      setKtpLoading(false);
    }
  }

  function handleReset() {
    setKtpFile(null);
    onKtpFile?.(null);
    setKtpFilename(""); setKtpStatus("idle"); setKtpConf(0);
    setKtpWarns([]); setErrorMsg("");
    setNama(""); setNik(""); setAlamat("");
    setSelectedUser(null); selectedUserRef.current = null;
    onDataChangeRef.current?.({ id_klien: null, nama_klien: "", nik_klien: "", alamat_klien: "" });
  }

  const ktpScanned = ktpStatus === "valid" || ktpStatus === "review";
  const nikValid = /^\d+$/.test(nik.trim()) && nik.trim().length > 0;
  const canProceed = ktpScanned && nama.trim().length > 0 && nikValid;

  return (
    <div className="space-y-5">

      {/* ── Section 1: Data Identitas Klien (UTAMA) ── */}
      <div
        className="overflow-hidden rounded-[24px] border border-white/[0.06]"
        style={{ background: "linear-gradient(180deg, #0b0e15 0%, #080a10 100%)" }}
      >
        {/* Header */}
        <div className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield size={15} className="text-emerald-400/70" />
              <span className="text-[12px] font-semibold text-white/80">Data Identitas Klien</span>
            </div>
            <div className="flex items-center gap-2">
              {ktpStatus !== "idle" && <ScanBadge status={ktpStatus} conf={ktpConf} />}
              {(nama || nik || alamat) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300 transition"
                >
                  <X size={11} />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* KTP dropzone compact — di dalam header card */}
          <div className="mt-3">
            <KtpDropzone filename={ktpFilename} loading={ktpLoading} status={ktpStatus} onFile={handleKtpFile} />
          </div>

          {/* Warning KTP */}
          {ktpWarns.length > 0 && (
            <div className="mt-2 space-y-1">
              {ktpWarns.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-300 ring-1 ring-amber-500/20">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          {errorMsg && !ktpWarns.length && (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-red-500/[0.07] px-3 py-2 text-[11px] text-red-300 ring-1 ring-red-500/20">
              <TriangleAlert size={12} className="mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Form fields — hanya tampil setelah KTP berhasil di-scan */}
        {ktpScanned ? (
          <div className="space-y-4 p-5">
            <FieldInput
              label="Nama Lengkap Klien"
              value={nama}
              onChange={(v) => { setNama(v); emit({ nama_klien: v }); }}
              placeholder="Diisi otomatis dari KTP"
              icon={<User2 size={14} />}
            />
            {/* NIK — angka saja */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">NIK (16 Digit)</label>
              <div className={cx(
                "flex items-start overflow-hidden rounded-xl transition-shadow duration-200",
                nik && !nikValid
                  ? "bg-red-500/[0.06] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.35)]"
                  : "bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] focus-within:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.40)]"
              )}>
                <div className="flex h-10 w-9 shrink-0 items-center justify-center border-r border-white/[0.06] text-zinc-500">
                  <CreditCard size={14} />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={nik}
                  maxLength={16}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setNik(v);
                    emit({ nik_klien: v });
                  }}
                  placeholder="16 digit sesuai KTP"
                  className="h-10 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </div>
              {nik && !nikValid && (
                <p className="text-[10px] text-red-400 flex items-center gap-1">
                  <TriangleAlert size={10} className="shrink-0" />
                  NIK hanya boleh berisi angka
                </p>
              )}
            </div>
            <FieldTextarea
              label="Alamat Lengkap"
              value={alamat}
              onChange={(v) => { setAlamat(v); emit({ alamat_klien: v }); }}
              placeholder="Diisi otomatis dari KTP"
              icon={<MapPin size={14} />}
            />
          </div>
        ) : (
          !ktpLoading && ktpStatus === "idle" && (
            <div className="px-5 pb-5 pt-2">
              <p className="text-[11px] text-zinc-600 text-center">
                Upload foto KTP di atas untuk mengisi data klien secara otomatis
              </p>
            </div>
          )
        )}
      </div>

      {/* ── Section 2: Hubungkan ke akun (OPSIONAL) ── */}
      <InlineUserPicker
        value={selectedUser}
        options={users}
        loading={usersLoading}
        onSelect={handleSelectUser}
      />

      {/* ── Lanjut button ── */}
      {onNext && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => onNext()}
            className="inline-flex h-11 items-center gap-2.5 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-white shadow-[0_0_24px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lanjut ke Pilih Agent
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
