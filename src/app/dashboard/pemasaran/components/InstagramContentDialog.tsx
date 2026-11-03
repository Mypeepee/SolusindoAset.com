"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DialogFrame } from "@/components/ui/dialog";
import {
  type InstagramDetail,
  instagramMediaLabel,
  instagramMetricLabels,
} from "@/lib/marketing/instagram-content";
import { Action, date, number } from "./ui";
import {
  Chart,
  MessageCircle,
  ExternalLink,
  RefreshCw,
} from "./MarketingIcons";
import { instagramRequest } from "./instagram-api";
import InstagramDeleteDialog from "./InstagramDeleteDialog";
import InstagramComments from "./InstagramComments";
import InstagramCarousel from "./InstagramCarousel";
import type { InstagramExample } from "./instagram-examples";

export default function InstagramContentDialog({
  mediaId,
  accountId,
  onClose,
  onDeleted,
  example,
  initialPanel = "analytics",
}: {
  mediaId: string;
  accountId?: string;
  onClose: () => void;
  onDeleted: () => void;
  example?: InstagramExample;
  initialPanel?: "analytics" | "comments";
}) {
  const [data, setData] = useState<InstagramDetail | null>(
      example?.detail || null,
    ),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(!example),
    [busy, setBusy] = useState(false),
    [commentBusy, setCommentBusy] = useState(false);
  const [panel, setPanel] = useState<"analytics" | "comments">(initialPanel);
  const [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false),
    [deleting, setDeleting] = useState(false);
  const discardCancel = useRef<HTMLButtonElement>(null);
  const generation = useRef(0),
    controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (example) {
      setData(example.detail);
      setLoading(false);
      return;
    }
    const sequence = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError("");
    try {
      const result = await instagramRequest<InstagramDetail>(
        { mode: "detail", mediaId },
        undefined,
        abort.signal,
      );
      if (sequence === generation.current) setData(result);
    } catch (failure) {
      if (
        sequence === generation.current &&
        (failure as Error).name !== "AbortError"
      )
        setError((failure as Error).message);
    } finally {
      if (sequence === generation.current) setLoading(false);
    }
  }, [mediaId, example]);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
      controller.current?.abort();
    };
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  function close() {
    if (busy || commentBusy) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  const post = data?.media;
  const interactions = data?.insights.find(
    (entry) => entry.name === "total_interactions",
  )?.value;
  const reach = data?.insights.find((entry) => entry.name === "reach")?.value;
  const rate =
    interactions != null && reach != null && reach > 0
      ? (interactions / reach) * 100
      : null;
  return (
    <>
      <DialogFrame
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title="Kelola konten Instagram"
        description="Lihat konten, analitik, komentar, dan tindakan untuk posting Instagram yang dipilih."
        contentClassName="marketing-modal instagram-detail-modal instagram-studio-dialog"
        hideClose={busy || commentBusy}
        focusFallbackId="instagram-content-search"
      >
        <header className="instagram-detail-header">
          <div>
            <h2>{example ? "Contoh postingan" : "Kelola konten"}</h2>
            <p className="marketing-muted">
              {post
                ? instagramMediaLabel(post) +
                  " · " +
                  date(post.timestamp) +
                  " WIB"
                : "Instagram"}
            </p>
          </div>
          <Action
            disabled={!!example || loading || busy || commentBusy}
            onClick={() => void load()}
            aria-label="Perbarui detail Instagram"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Action>
        </header>
        {example && (
          <div className="ig-detail-example-label" role="status">
            <strong>Contoh tampilan</strong>
            <span>
              Caption, komentar, dan angka merupakan ilustrasi. Tidak terhubung
              ke posting asli.
            </span>
          </div>
        )}
        {error && (
          <div className="instagram-notice marketing-error" role="alert">
            <p>{error}</p>
            <Action disabled={loading} onClick={() => void load()}>
              Coba kembali
            </Action>
          </div>
        )}
        {!data && loading && (
          <div className="instagram-loading" role="status">
            <RefreshCw size={24} className="animate-spin" />
            Mengambil konten dan analitik…
          </div>
        )}
        {data && post && (
          <div className="instagram-detail-layout">
            <div className="instagram-post-preview">
              <InstagramCarousel
                media={post}
                slides={data.children}
                labels={example?.slideLabels}
              />
              <div className="instagram-caption">
                <h3>Caption</h3>
                <p>{post.caption || "Tanpa caption"}</p>
              </div>
              {post.permalink && (
                <a
                  className="marketing-link"
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buka di Instagram
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
            <div className="instagram-detail-content">
              <div
                className="instagram-segments"
                aria-label="Bagian detail Instagram"
              >
                <button
                  type="button"
                  aria-pressed={panel === "analytics"}
                  disabled={commentBusy}
                  onClick={() => setPanel("analytics")}
                >
                  <Chart size={15} />
                  Analitik
                </button>
                <button
                  type="button"
                  aria-pressed={panel === "comments"}
                  disabled={commentBusy}
                  onClick={() => setPanel("comments")}
                >
                  <MessageCircle size={15} />
                  Komentar
                </button>
              </div>
              <div hidden={panel !== "analytics"}>
                <p className="marketing-footnote">
                  {example ? (
                    "Analitik ilustrasi untuk contoh posting ini."
                  ) : (
                    <>
                      Akumulasi sejak konten terbit. Diperbarui{" "}
                      {date(data.fetchedAt)} WIB.
                    </>
                  )}
                </p>
                {!data.capabilities.insights && (
                  <p className="instagram-notice">
                    Izin analitik belum tersedia. Lengkapi akses melalui
                    Pengaturan koneksi.
                  </p>
                )}
                <dl className="instagram-metrics">
                  {data.insights.map((entry) => (
                    <div key={entry.name}>
                      <dt>{instagramMetricLabels[entry.name] || entry.name}</dt>
                      <dd
                        title={
                          entry.value === null
                            ? "Instagram belum memberikan metrik ini untuk konten tersebut."
                            : undefined
                        }
                      >
                        {formatMetric(entry.name, entry.value)}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt>Interaksi / jangkauan</dt>
                    <dd>
                      {rate === null
                        ? "Belum tersedia"
                        : new Intl.NumberFormat("id-ID", {
                            maximumFractionDigits: 2,
                          }).format(rate) + "%"}
                    </dd>
                  </div>
                </dl>
                <p className="marketing-footnote">
                  Rasio = total interaksi ÷ akun dijangkau × 100%. Metrik dapat
                  terlambat hingga 48 jam dan berbeda menurut format serta usia
                  konten. Jangkauan merupakan estimasi Instagram.
                </p>
              </div>
              <div hidden={panel !== "comments"}>
                {example ? (
                  <div className="ig-example-comments">
                    <p className="marketing-footnote">
                      Contoh percakapan. Komentar dan balasan ini tidak dikirim
                      ke Instagram.
                    </p>
                    <article className="instagram-comment">
                      <header>
                        <strong>@pengunjung_contoh</strong>
                        <span>Komentar ilustrasi</span>
                      </header>
                      <p>
                        Boleh minta informasi lebih lanjut tentang properti ini?
                      </p>
                      <div className="instagram-replies">
                        <article className="instagram-comment">
                          <header>
                            <strong>@akun_contoh</strong>
                            <span>Balasan ilustrasi</span>
                          </header>
                          <p>
                            Tentu. Ceritakan kebutuhan Anda, tim kami akan
                            membantu memilih properti yang sesuai.
                          </p>
                        </article>
                      </div>
                    </article>
                    <p className="ig-demo-readonly">
                      Pada posting asli, Anda dapat membalas, menyembunyikan,
                      dan menghapus komentar dari bagian ini.
                    </p>
                  </div>
                ) : (
                  <InstagramComments
                    active={panel === "comments"}
                    media={post}
                    accountId={accountId}
                    allowed={data.capabilities.comments}
                    onDirty={setDirty}
                    onBusy={setCommentBusy}
                  />
                )}
              </div>
              {!example && (
                <section className="instagram-manage">
                  <h3>Kelola posting</h3>
                  <p className="marketing-footnote">
                    Arsip sementara dan perubahan caption dilakukan di
                    Instagram. Menghapus carousel akan menghapus seluruh album.
                  </p>
                  {post.permalink && (
                    <a
                      className="marketing-link"
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buka untuk arsip atau edit
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <Action
                    className="instagram-danger"
                    disabled={
                      !data.capabilities.deleteMedia ||
                      !accountId ||
                      loading ||
                      dirty ||
                      busy ||
                      commentBusy
                    }
                    onClick={() => setDeleting(true)}
                  >
                    Hapus dari Instagram
                  </Action>
                  {!data.capabilities.deleteMedia && (
                    <p className="marketing-footnote">
                      Hapus memerlukan Facebook Login dan izin
                      instagram_manage_contents. Hubungkan ulang setelah izin
                      ditambahkan di Meta.
                    </p>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </DialogFrame>
      {deleting && post && accountId && (
        <InstagramDeleteDialog
          media={post}
          accountId={accountId}
          nested
          onClose={() => setDeleting(false)}
          onDeleted={onDeleted}
          onBusy={setBusy}
        />
      )}
      <DialogFrame
        open={discard}
        onOpenChange={setDiscard}
        title="Buang draf balasan?"
        description="Balasan belum dikirim ke Instagram."
        contentClassName="marketing-modal marketing-small-modal instagram-studio-dialog"
        layer={10002}
        initialFocusRef={discardCancel}
      >
        <h2>Buang draf balasan?</h2>
        <p>
          Balasan yang belum dikirim akan hilang ketika detail konten ditutup.
        </p>
        <div className="marketing-modal-actions">
          <Action ref={discardCancel} onClick={() => setDiscard(false)}>
            Lanjut menulis
          </Action>
          <Action className="instagram-danger" onClick={onClose}>
            Buang draf
          </Action>
        </div>
      </DialogFrame>
    </>
  );
}
function formatMetric(name: string, value: number | null) {
  if (value === null) return "Belum tersedia";
  if (name.includes("watch_time") || name === "ig_reels_video_view_total_time")
    return (
      new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(
        value / 1000,
      ) + " dtk"
    );
  return number(value) + (name === "reels_skip_rate" ? "%" : "");
}
