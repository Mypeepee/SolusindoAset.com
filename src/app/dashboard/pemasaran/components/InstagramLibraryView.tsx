"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Input } from "@/components/ui/input";
import type {
  InstagramDetail,
  InstagramLibrary,
  InstagramMedia,
} from "@/lib/marketing/instagram-content";
import { instagramMediaLabel } from "@/lib/marketing/instagram-content";
import { Action, date, number } from "./ui";
import {
  Instagram,
  RefreshCw,
  ImageIcon,
  Chart,
  MessageCircle,
  Close,
  ExternalLink,
  Eye,
  Heart,
  Search,
  Layers,
  CheckCircle,
  ArrowRight,
  Play,
  Person,
  Clock,
  Trash,
} from "./MarketingIcons";
import { findInstagramExample } from "./instagram-examples";
import { instagramRequest } from "./instagram-api";
import InstagramCarousel from "./InstagramCarousel";

type Props = {
  data: InstagramLibrary | null;
  items: InstagramMedia[];
  totalLoaded: number;
  loading: boolean;
  error: string;
  examples: boolean;
  query: string;
  filter: string;
  kind: "media" | "stories";
  searchRef: RefObject<HTMLInputElement>;
  onSettings: () => void;
  onRefresh: () => void;
  onMore: () => void;
  onSource: (value: "live" | "examples") => void;
  onKind: (value: "media" | "stories") => void;
  onQuery: (value: string) => void;
  onFilter: (value: string) => void;
  onClear: () => void;
  onOpen: (item: InstagramMedia, panel?: "analytics" | "comments") => void;
  onDelete: (item: InstagramMedia) => void;
};

export default function InstagramLibraryView({
  data,
  items,
  totalLoaded,
  loading,
  error,
  examples,
  query,
  filter,
  kind,
  searchRef,
  onSettings,
  onRefresh,
  onMore,
  onSource,
  onKind,
  onQuery,
  onFilter,
  onClear,
  onOpen,
  onDelete,
}: Props) {
  const [selectedId, setSelectedId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("igPreview") || "",
  );
  const selected = items.find((item) => item.id === selectedId) || items[0];
  const reduced = useReducedMotion();
  const inspector = useRef<HTMLElement>(null);
  const canDelete =
    !!data?.capabilities.verified &&
    !!data.capabilities.deleteMedia &&
    !!data.account.id &&
    !loading;
  function select(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("igPreview", id);
    window.history.replaceState(null, "", url);
    // A stacked inspector must be discoverable after choosing a post on a phone.
    const panel = inspector.current;
    const gallery = panel?.previousElementSibling;
    if (
      panel &&
      gallery &&
      Math.abs(
        panel.getBoundingClientRect().left -
          gallery.getBoundingClientRect().left,
      ) < 2
    ) {
      panel.scrollIntoView({
        behavior: reduced ? "instant" : "smooth",
        block: "start",
      });
    }
  }
  return (
    <motion.div
      className="instagram-workspace instagram-studio"
      data-source={examples ? "examples" : "live"}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="ig-studio-heading">
        <div className="ig-studio-title">
          <span className="ig-brand-icon">
            <Instagram size={25} />
          </span>
          <div>
            <h2>
              Instagram <span className="ig-heading-badge">Pustaka konten</span>
            </h2>
            <p>Semua unggahan, cerita, dan interaksi dalam satu ruang.</p>
          </div>
        </div>
        <div className="ig-account-actions">
          {data && (
            <a
              className="instagram-account"
              aria-label={`Buka profil Instagram @${data.account.username}, akun terhubung, di tab baru`}
              title={`@${data.account.username} · Akun terhubung`}
              href={`https://www.instagram.com/${encodeURIComponent(data.account.username)}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <AccountAvatar
                key={data.account.picture}
                picture={data.account.picture}
              />
              <span className="ig-account-copy">
                <strong>@{data.account.username}</strong>
                <small>
                  <CheckCircle size={12} /> Akun terhubung
                </small>
              </span>
              <ExternalLink size={14} />
            </a>
          )}
          <Action
            className="ig-refresh"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Perbarui konten Instagram"
            title="Sinkronkan Instagram"
            aria-busy={loading}
          >
            <RefreshCw size={16} />
            <span className="ig-refresh-label">Sinkronkan</span>
          </Action>
        </div>
      </header>

      <AccountStats data={data} kind={kind} />

      <div className="ig-library-toolbar">
        <div className="ig-source-control" aria-label="Sumber konten">
          <button
            type="button"
            aria-pressed={!examples}
            onClick={() => onSource("live")}
          >
            <CheckCircle size={15} /> Sudah diunggah
            {data && <span>{number(data.account.mediaCount)}</span>}
          </button>
          <button
            type="button"
            aria-pressed={examples}
            onClick={() => onSource("examples")}
          >
            <Layers size={15} /> Contoh carousel
          </button>
        </div>
        <div className="instagram-search">
          <Search size={16} />
          <Input
            id="instagram-content-search"
            ref={searchRef}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Cari caption atau ID unggahan…"
            aria-label="Cari konten Instagram yang dimuat"
          />
          {query && (
            <button
              type="button"
              aria-label="Hapus pencarian konten"
              onClick={() => {
                onQuery("");
                searchRef.current?.focus();
              }}
            >
              <Close size={15} />
            </button>
          )}
        </div>
      </div>
      {examples ? (
        <div className="ig-example-banner" role="status">
          <Layers size={16} />
          <p>
            <strong>Mode contoh.</strong> Carousel dan metrik ilustrasi, belum
            diterbitkan ke Instagram.
          </p>
          <button type="button" onClick={() => onSource("live")}>
            Lihat unggahan asli <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="ig-live-controls">
          <div className="instagram-segments" aria-label="Jenis daftar konten">
            <button
              type="button"
              aria-pressed={kind === "media"}
              onClick={() => onKind("media")}
            >
              <ImageIcon size={14} /> Feed & Reel
            </button>
            <button
              type="button"
              aria-pressed={kind === "stories"}
              onClick={() => onKind("stories")}
            >
              <Clock size={14} /> Story aktif
            </button>
          </div>
          {kind === "media" && (
            <div className="instagram-filters" aria-label="Filter unggahan">
              {[
                ["all", "Semua"],
                ["carousel", "Carousel"],
                ["foto", "Foto"],
                ["reel", "Reel"],
                ["video", "Video"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => onFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {data &&
        (!data.capabilities.verified ||
          !data.capabilities.comments ||
          !data.capabilities.deleteMedia ||
          !data.capabilities.insights) && (
          <div className="instagram-notice" role="status">
            <div>
              <strong>Akses akun perlu dilengkapi</strong>
              <p>
                Beberapa fitur analitik atau pengelolaan belum tersedia untuk
                koneksi ini.
              </p>
            </div>
            <Action onClick={onSettings}>Pengaturan koneksi</Action>
          </div>
        )}
      {error && (
        <div className="instagram-notice marketing-error" role="alert">
          <p>
            {error}
            {data && !examples ? " Data sebelumnya tetap ditampilkan." : ""}
          </p>
          <Action disabled={loading} onClick={onRefresh}>
            Coba kembali
          </Action>
        </div>
      )}
      {loading && !items.length && (
        <div className="ig-loading" role="status">
          <RefreshCw size={24} />
          <p>Memuat unggahan Instagram…</p>
        </div>
      )}
      {!loading && !error && !items.length && (
        <div className="ig-empty">
          <div>
            <ImageIcon size={26} />
          </div>
          <h3>
            {query || filter !== "all"
              ? "Unggahan tidak ditemukan"
              : kind === "stories"
                ? "Belum ada Story aktif"
                : "Belum ada unggahan"}
          </h3>
          <p>
            {query || filter !== "all"
              ? "Coba kata lain atau hapus filter pencarian."
              : kind === "stories"
                ? "Story yang masih aktif akan muncul di sini."
                : "Unggahan dari akun Instagram terhubung akan tampil di sini. Sinkronkan untuk memeriksa konten terbaru."}
          </p>
          {query || filter !== "all" ? (
            <Action onClick={onClear}>Hapus filter</Action>
          ) : (
            kind === "media" && (
              <div className="ig-empty-actions">
                <Action primary onClick={onRefresh}>
                  <RefreshCw size={15} /> Sinkronkan unggahan
                </Action>
                <Action onClick={() => onSource("examples")}>
                  Lihat contoh carousel
                </Action>
              </div>
            )
          )}
        </div>
      )}
      {items.length > 0 && (
        <div
          className={`ig-content-layout${items.length <= 3 ? " ig-content-layout-compact" : ""}`}
        >
          <section
            className="ig-gallery-panel"
            aria-label={
              examples ? "Galeri contoh carousel" : "Galeri unggahan Instagram"
            }
          >
            <div className="ig-gallery-heading">
              <div>
                <h3>
                  {examples
                    ? "Eksplorasi carousel"
                    : kind === "stories"
                      ? "Story aktif"
                      : "Galeri unggahan"}
                </h3>
                <span>
                  {number(items.length)} {examples ? "contoh" : "ditampilkan"}
                </span>
              </div>
              <span className="ig-gallery-hint" role="status">
                {loading
                  ? "Memperbarui…"
                  : error && !examples
                    ? "Data sebelumnya"
                    : "Pilih untuk pratinjau"}
              </span>
            </div>
            <div
              className="ig-post-picker"
              aria-label="Pilih unggahan"
              aria-busy={loading && !examples}
            >
              {items.map((item, index) => (
                <PostCard
                  key={item.id}
                  media={item}
                  examples={examples}
                  selected={selected?.id === item.id}
                  index={index}
                  onSelect={() => select(item.id)}
                  onDelete={() => onDelete(item)}
                  canDelete={canDelete}
                />
              ))}
            </div>
            <footer className="ig-library-footer">
              <span>
                {examples
                  ? "Contoh desain, terpisah dari unggahan akun."
                  : `${number(totalLoaded)} ${kind === "stories" ? "Story" : "unggahan"} dimuat${data?.after ? ". Masih ada konten lainnya." : "."}`}
              </span>
              {!examples && data?.after && (
                <Action onClick={onMore} disabled={loading}>
                  {loading ? "Memuat…" : "Muat lebih banyak"}
                </Action>
              )}
              {!examples && data && (
                <small>Sinkronisasi terakhir: {date(data.fetchedAt)} WIB</small>
              )}
            </footer>
          </section>
          {selected && (
            <aside
              className="ig-inspector-shell"
              id="ig-selected-post"
              ref={inspector}
              aria-label="Detail unggahan terpilih"
            >
              <div className="ig-inspector-core">
                <div className="ig-inspector-heading">
                  <span>
                    <Eye size={15} /> Pratinjau unggahan
                  </span>
                  <span>{examples ? "Contoh" : "Sudah terbit"}</span>
                </div>
                <SelectedPost
                  key={selected.id + String(examples) + data?.fetchedAt}
                  media={selected}
                  examples={examples}
                  onOpen={onOpen}
                  onDelete={onDelete}
                  canDelete={canDelete}
                />
              </div>
            </aside>
          )}
        </div>
      )}
    </motion.div>
  );
}

function AccountStats({
  data,
  kind,
}: {
  data: InstagramLibrary | null;
  kind: Props["kind"];
}) {
  const total = (field: "likes" | "comments") =>
    data && kind === "media" && data.items.every((item) => item[field] !== null)
      ? data.items.reduce((sum, item) => sum + (item[field] ?? 0), 0)
      : null;
  const stats = [
    {
      label: "Unggahan",
      value: data?.account.mediaCount,
      hint: "Seluruh akun",
      icon: ImageIcon,
      tone: "emerald",
    },
    {
      label: "Pengikut",
      value: data?.account.followers,
      hint: "Akun terhubung",
      icon: Person,
      tone: "violet",
    },
    {
      label: "Suka",
      value: total("likes"),
      hint:
        kind === "media"
          ? "Pada unggahan dimuat"
          : "Tidak tersedia untuk Story",
      icon: Heart,
      tone: "coral",
    },
    {
      label: "Komentar",
      value: total("comments"),
      hint:
        kind === "media"
          ? "Pada unggahan dimuat"
          : "Tidak tersedia untuk Story",
      icon: MessageCircle,
      tone: "amber",
    },
  ];
  return (
    <div
      className="ig-account-stats"
      role="group"
      aria-label="Ringkasan akun Instagram"
    >
      {stats.map(({ label, value, hint, icon: Icon, tone }) => (
        <div className="ig-stat-shell" data-tone={tone} key={label}>
          <div className="ig-stat-core">
            <span className="ig-stat-icon">
              <Icon size={19} />
            </span>
            <dl>
              <dt>{label}</dt>
              <dd className={value == null ? "ig-unavailable" : ""}>
                {number(value)}
                <small>{hint}</small>
              </dd>
            </dl>
          </div>
        </div>
      ))}
    </div>
  );
}

function PostCard({
  media,
  examples,
  selected,
  index,
  onSelect,
  onDelete,
  canDelete,
}: {
  media: InstagramMedia;
  examples: boolean;
  selected: boolean;
  index: number;
  onSelect: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const example = examples ? findInstagramExample(media.id) : undefined;
  const label = instagramMediaLabel(media);
  const Icon =
    label === "Carousel" ? Layers : media.type === "VIDEO" ? Play : ImageIcon;
  const title =
    example?.title || media.caption.split("\n")[0] || "Tanpa caption";
  return (
    <article
      className="ig-post-card instagram-card"
      data-selected={selected}
      style={
        {
          "--ig-card-delay": `${Math.min(index, 8) * 35}ms`,
        } as React.CSSProperties
      }
    >
      <button
        className="ig-post-preview"
        type="button"
        aria-pressed={selected}
        aria-controls="ig-selected-post"
        aria-label={`Pratinjau ${title}`}
        onClick={onSelect}
      >
        <span className="ig-card-core">
          <span className="ig-picker-photo">
            <PostThumbnail media={media} />
            <span className="ig-card-format">
              <Icon size={12} />
              {label}
            </span>
            <span className="ig-picker-selected">
              <CheckCircle size={17} />
            </span>
          </span>
          <span className="ig-card-body">
            <strong title={title}>{title}</strong>
            <small>
              {example
                ? `${example.detail.children.length} slide · ${example.category}`
                : `${date(media.timestamp)} WIB`}
            </small>
            <span className="ig-card-bottom">
              <span>
                <Heart size={13} />
                <span>
                  {media.likes == null ? "Belum tersedia" : number(media.likes)}
                </span>
              </span>
              <span>
                <MessageCircle size={13} />
                <span>
                  {media.comments == null
                    ? "Belum tersedia"
                    : number(media.comments)}
                </span>
              </span>
              {examples && <em>Contoh</em>}
            </span>
          </span>
        </span>
      </button>
      {!examples && (
        <div className="ig-card-actions">
          <Action
            className="instagram-danger"
            disabled={!canDelete}
            onClick={onDelete}
            title={
              canDelete
                ? "Hapus postingan dari Instagram"
                : "Izin hapus belum tersedia atau data sedang diperbarui"
            }
            aria-label={`Hapus postingan ${title}`}
          >
            <Trash size={15} />
            Hapus
          </Action>
        </div>
      )}
    </article>
  );
}

function PostThumbnail({ media }: { media: InstagramMedia }) {
  const [failed, setFailed] = useState(false);
  const src =
    media.thumbnailUrl || (media.type !== "VIDEO" ? media.mediaUrl : null);
  return src && !failed ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="ig-thumbnail-fallback">
      <ImageIcon size={23} />
      <span>Pratinjau belum tersedia</span>
    </span>
  );
}

function SelectedPost({
  media,
  examples,
  onOpen,
  onDelete,
  canDelete,
}: {
  media: InstagramMedia;
  examples: boolean;
  onOpen: Props["onOpen"];
  onDelete: Props["onDelete"];
  canDelete: boolean;
}) {
  const example = examples ? findInstagramExample(media.id) : undefined;
  const [detail, setDetail] = useState<InstagramDetail | null>(
    example?.detail || null,
  );
  const [pending, setPending] = useState(!example);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (example) return;
    const controller = new AbortController();
    setPending(true);
    instagramRequest<InstagramDetail>(
      { mode: "detail", mediaId: media.id },
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setDetail(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });
    return () => controller.abort();
  }, [media.id, example]);
  const metric = (name: string) =>
    detail?.insights.find((item) => item.name === name)?.value;
  return (
    <div className="ig-review-layout">
      <div className="ig-review-info">
        <div className="ig-review-eyebrow">
          <Layers size={13} />
          <span>{instagramMediaLabel(media)}</span>
        </div>
        <h3>
          {example?.title ||
            media.caption.split("\n")[0] ||
            "Unggahan Instagram"}
        </h3>
        <p className="ig-review-location">
          {example?.location || `${date(media.timestamp)} WIB`}
        </p>
      </div>
      <div className="ig-review-artwork">
        <InstagramCarousel
          key={media.id}
          media={media}
          slides={detail?.children || []}
          labels={example?.slideLabels}
        />
        {pending && (
          <p className="marketing-footnote" role="status">
            Memuat slide dan analitik…
          </p>
        )}
        {error && (
          <p className="marketing-error" role="alert">
            {error} Buka kelola untuk mencoba kembali.
          </p>
        )}
      </div>
      <div className="ig-caption-block">
        <div className="ig-section-label">
          <h4>Caption</h4>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="ig-selected-caption"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Ringkas" : "Baca lengkap"}
          </button>
        </div>
        <p id="ig-selected-caption" data-expanded={expanded}>
          {media.caption || "Tanpa caption"}
        </p>
      </div>
      <div className="ig-performance">
        <div className="ig-section-label">
          <h4>Performa unggahan</h4>
          <span>{examples ? "Metrik ilustrasi" : "Akumulasi"}</span>
        </div>
        <dl>
          {[
            { label: "Tayangan", icon: Eye, value: metric("views") },
            {
              label: "Suka",
              icon: Heart,
              value: detail?.media.likes ?? media.likes,
            },
            {
              label: "Komentar",
              icon: MessageCircle,
              value: detail?.media.comments ?? media.comments,
            },
          ].map(({ label, icon: Icon, value }) => (
            <div key={label}>
              <dt>
                <Icon size={13} />
                {label}
              </dt>
              <dd className={value == null ? "ig-unavailable" : ""}>
                {number(value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="ig-review-actions">
        <Action primary onClick={() => onOpen(media)}>
          <Chart size={16} />
          Analitik & kelola
          <span className="ig-button-icon">
            <ArrowRight size={16} />
          </span>
        </Action>
        <Action
          className="ig-comment-action"
          onClick={() => onOpen(media, "comments")}
          aria-label="Buka komentar unggahan"
          title="Buka komentar"
        >
          <MessageCircle size={18} />
        </Action>
        {!examples && (
          <Action
            className="instagram-danger ig-delete-post"
            disabled={!canDelete}
            onClick={() => onDelete(media)}
          >
            <Trash size={15} />
            Hapus
          </Action>
        )}
      </div>
      {!examples && media.permalink && (
        <a
          className="ig-instagram-link"
          href={media.permalink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Lihat di Instagram
          <span>
            <ExternalLink size={13} />
          </span>
        </a>
      )}
    </div>
  );
}

function AccountAvatar({ picture }: { picture: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="ig-account-avatar">
      {picture && !failed ? (
        <img
          src={picture}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Instagram size={19} />
      )}
    </span>
  );
}
