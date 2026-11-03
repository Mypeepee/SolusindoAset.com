"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DialogFrame } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  type InstagramComment,
  type InstagramMedia,
  type InstagramPage,
} from "@/lib/marketing/instagram-content";
import { Action, date, number } from "./ui";
import { RefreshCw, MessageCircle } from "./MarketingIcons";
import { instagramRequest } from "./instagram-api";

export default function InstagramComments({
  active,
  media,
  accountId,
  allowed,
  onDirty,
  onBusy,
}: {
  active: boolean;
  media: InstagramMedia;
  accountId?: string;
  allowed: boolean;
  onDirty: (value: boolean) => void;
  onBusy: (value: boolean) => void;
}) {
  const [comments, setComments] = useState<InstagramPage<InstagramComment>>({
    items: [],
    after: null,
  });
  const [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState<InstagramComment | null>(null),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [mutationError, setMutationError] = useState(""),
    [blocked, setBlocked] = useState(false);
  const [confirmation, setConfirmation] = useState<{
      comment: InstagramComment;
      requestId: string;
    } | null>(null),
    [confirmationError, setConfirmationError] = useState("");
  const [enabled, setEnabled] = useState(media.commentsEnabled);
  const [threads, setThreads] = useState<
      Record<string, InstagramPage<InstagramComment>>
    >({}),
    [threadBusy, setThreadBusy] = useState("");
  const requestKey = useRef(""),
    mutation = useRef(false),
    generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    cancel = useRef<HTMLButtonElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLDivElement>(null),
    live = useRef(true),
    loadLock = useRef(false),
    replyController = useRef<AbortController | null>(null);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
      controller.current?.abort();
      replyController.current?.abort();
    };
  }, []);
  useEffect(() => onDirty(!!message.trim()), [message, onDirty]);
  useEffect(() => setEnabled(media.commentsEnabled), [media.commentsEnabled]);
  const load = useCallback(
    async (after?: string) => {
      if (after && loadLock.current) return;
      loadLock.current = true;
      const sequence = ++generation.current;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setLoading(true);
      setError("");
      try {
        const result = await instagramRequest<InstagramPage<InstagramComment>>(
          { mode: "comments", mediaId: media.id, ...(after ? { after } : {}) },
          undefined,
          abort.signal,
        );
        if (sequence === generation.current) {
          setComments((previous) => ({
            ...result,
            items: after
              ? [
                  ...new Map(
                    [...previous.items, ...result.items].map((item) => [
                      item.id,
                      item,
                    ]),
                  ).values(),
                ]
              : result.items,
          }));
          setLoaded(true);
        }
      } catch (failure) {
        if (
          sequence === generation.current &&
          (failure as Error).name !== "AbortError"
        )
          setError((failure as Error).message);
      } finally {
        if (sequence === generation.current) {
          loadLock.current = false;
          setLoading(false);
        }
      }
    },
    [media.id],
  );
  useEffect(() => {
    if (active && allowed && !loaded) void load();
  }, [active, allowed, loaded, load]);
  async function replies(id: string, after?: string) {
    if (threadBusy) return;
    setThreadBusy(id);
    setError("");
    replyController.current?.abort();
    const abort = new AbortController();
    replyController.current = abort;
    try {
      const result = await instagramRequest<InstagramPage<InstagramComment>>(
        {
          mode: "replies",
          mediaId: media.id,
          commentId: id,
          ...(after ? { after } : {}),
        },
        undefined,
        abort.signal,
      );
      if (live.current)
        setThreads((previous) => ({
          ...previous,
          [id]: {
            ...result,
            items: after
              ? [
                  ...new Map(
                    [...(previous[id]?.items || []), ...result.items].map(
                      (item) => [item.id, item],
                    ),
                  ).values(),
                ]
              : result.items,
          },
        }));
    } catch (failure) {
      if (live.current && (failure as Error).name !== "AbortError")
        setError((failure as Error).message);
    } finally {
      if (live.current) setThreadBusy("");
    }
  }
  async function perform(
    action: string,
    fields: Record<string, unknown>,
    requestId = crypto.randomUUID(),
  ) {
    if (mutation.current || !accountId) return false;
    generation.current++;
    controller.current?.abort();
    replyController.current?.abort();
    loadLock.current = false;
    setLoading(false);
    setThreadBusy("");
    mutation.current = true;
    setBusy(true);
    onBusy(true);
    setMutationError("");
    setConfirmationError("");
    try {
      await instagramRequest(
        {},
        { action, accountId, mediaId: media.id, requestId, ...fields },
      );
      toast.success(
        action === "reply"
          ? "Balasan dikirim ke Instagram."
          : action === "delete-comment"
            ? "Komentar dihapus."
            : action === "hide-comment"
              ? fields.hidden
                ? "Komentar disembunyikan."
                : "Komentar ditampilkan kembali."
              : fields.enabled
                ? "Komentar diaktifkan."
                : "Komentar dinonaktifkan.",
      );
      return true;
    } catch (failure) {
      const code = (failure as { code?: string }).code;
      const text = code
        ? (failure as Error).message
        : "Hasil tindakan belum dapat dipastikan. Periksa Instagram sebelum mencoba tindakan baru.";
      if (action === "delete-comment") setConfirmationError(text);
      else setMutationError(text);
      if (
        action === "reply" &&
        (!code ||
          [
            "INSTAGRAM_ACTION_UNCERTAIN",
            "INSTAGRAM_ACTION_PENDING",
            "INSTAGRAM_ACTION_FAILED",
          ].includes(code))
      )
        setBlocked(true);
      return false;
    } finally {
      mutation.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  async function sendReply() {
    if (
      !replyTo ||
      !message.trim() ||
      message.trim().length > 2200 ||
      blocked
    ) {
      textarea.current?.focus();
      return;
    }
    requestKey.current ||= crypto.randomUUID();
    if (
      await perform(
        "reply",
        { commentId: replyTo.id, message: message.trim() },
        requestKey.current,
      )
    ) {
      const parentId = replyTo.id;
      setMessage("");
      setReplyTo(null);
      requestKey.current = "";
      setBlocked(false);
      await replies(parentId);
      void load();
    }
  }
  function chooseReply(item: InstagramComment) {
    if (replyTo?.id === item.id) {
      textarea.current?.focus();
      return;
    }
    // Preserve a draft until the user clears or sends it.
    if (message.trim() && replyTo?.id !== item.id) {
      setMutationError(
        "Kirim atau kosongkan draf balasan saat ini sebelum memilih komentar lain.",
      );
      return;
    }
    setReplyTo(item);
    setMutationError("");
    requestKey.current = "";
    setBlocked(false);
    requestAnimationFrame(() => {
      composer.current?.scrollIntoView({ block: "nearest" });
      textarea.current?.focus();
    });
  }
  function renderComment(item: InstagramComment, parentId?: string) {
    return (
      <article
        key={item.id}
        className="instagram-comment"
        data-hidden={item.hidden || undefined}
      >
        <header>
          <strong>
            {item.username ? "@" + item.username : "Pengguna Instagram"}
          </strong>
          <span>{date(item.timestamp)} WIB</span>
        </header>
        <p>{item.text}</p>
        <div className="instagram-comment-meta">
          {item.hidden && <span>Disembunyikan</span>}
          {item.likes !== null && <span>{number(item.likes)} suka</span>}
        </div>
        <div className="instagram-comment-actions">
          <Action
            disabled={busy}
            onClick={() =>
              chooseReply(
                parentId
                  ? comments.items.find((row) => row.id === parentId) || item
                  : item,
              )
            }
          >
            Balas
          </Action>
          {item.hidden !== null && (
            <Action
              disabled={busy}
              onClick={() =>
                void perform("hide-comment", {
                  commentId: item.id,
                  hidden: !item.hidden,
                }).then((ok) => {
                  if (ok) {
                    setComments((previous) => ({
                      ...previous,
                      items: previous.items.map((row) =>
                        row.id === item.id
                          ? { ...row, hidden: !item.hidden }
                          : row,
                      ),
                    }));
                    setThreads((previous) =>
                      Object.fromEntries(
                        Object.entries(previous).map(([id, value]) => [
                          id,
                          {
                            ...value,
                            items: value.items.map((row) =>
                              row.id === item.id
                                ? { ...row, hidden: !item.hidden }
                                : row,
                            ),
                          },
                        ]),
                      ),
                    );
                  }
                })
              }
            >
              {item.hidden ? "Tampilkan" : "Sembunyikan"}
            </Action>
          )}
          <Action
            className="instagram-danger"
            disabled={busy}
            onClick={() =>
              setConfirmation({ comment: item, requestId: crypto.randomUUID() })
            }
          >
            Hapus
          </Action>
          {!parentId && (
            <Action
              disabled={!!threadBusy || busy}
              onClick={() => void replies(item.id)}
            >
              {threadBusy === item.id ? "Memuat…" : "Lihat balasan"}
            </Action>
          )}
        </div>
        {!parentId && threads[item.id] && (
          <div className="instagram-replies">
            {threads[item.id].items.length ? (
              threads[item.id].items.map((reply) =>
                renderComment(reply, item.id),
              )
            ) : (
              <p className="marketing-footnote">Belum ada balasan.</p>
            )}
            {threads[item.id].after && (
              <Action
                disabled={!!threadBusy}
                onClick={() => void replies(item.id, threads[item.id].after!)}
              >
                Muat balasan berikutnya
              </Action>
            )}
          </div>
        )}
      </article>
    );
  }
  if (!allowed || !accountId)
    return (
      <p className="instagram-notice">
        Izin komentar belum tersedia. Hubungkan ulang Instagram dan setujui
        akses komentar melalui Pengaturan.
      </p>
    );
  return (
    <div className="instagram-comments">
      <div className="instagram-comment-toolbar">
        <p>
          {enabled === null
            ? "Status komentar belum tersedia"
            : enabled
              ? "Komentar aktif"
              : "Komentar nonaktif"}
        </p>
        <div>
          <Action
            disabled={busy || loading}
            id="instagram-comments-refresh"
            aria-label="Perbarui komentar"
            onClick={() => void load()}
          >
            <RefreshCw size={15} />
          </Action>
          {enabled !== null && (
            <Action
              disabled={busy}
              onClick={() =>
                void perform("comments-enabled", { enabled: !enabled }).then(
                  (ok) => {
                    if (ok) setEnabled(!enabled);
                  },
                )
              }
            >
              {enabled ? "Nonaktifkan" : "Aktifkan"}
            </Action>
          )}
        </div>
      </div>
      {loading && (
        <p className="marketing-footnote" role="status">
          Memuat komentar…
        </p>
      )}
      {error && (
        <div className="instagram-notice marketing-error" role="alert">
          <p>{error}</p>
          <Action disabled={loading} onClick={() => void load()}>
            Coba kembali
          </Action>
        </div>
      )}
      {mutationError && (
        <p className="instagram-notice marketing-error" role="alert">
          {mutationError}
        </p>
      )}
      {loaded && !comments.items.length && (
        <div className="instagram-comment-empty">
          <MessageCircle size={24} />
          <p>Belum ada komentar yang tersedia.</p>
        </div>
      )}
      {comments.items.map((item) => renderComment(item))}
      {comments.after && (
        <Action
          disabled={loading || busy}
          onClick={() => void load(comments.after!)}
        >
          Muat komentar berikutnya
        </Action>
      )}
      {replyTo && (
        <div className="instagram-composer" ref={composer}>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void sendReply();
            }}
          >
            <label htmlFor="instagram-reply">
              Balas {replyTo.username ? "@" + replyTo.username : "komentar"}
            </label>
            <blockquote>{replyTo.text}</blockquote>
            <Textarea
              id="instagram-reply"
              ref={textarea}
              className="resize-none"
              rows={4}
              value={message}
              maxLength={2200}
              disabled={busy || blocked}
              aria-describedby="instagram-reply-help"
              onChange={(event) => {
                setMessage(event.target.value);
                requestKey.current = "";
              }}
            />
            <p id="instagram-reply-help">
              {message.length}/2.200 karakter · Balasan dipublikasikan atas nama
              akun perusahaan.
            </p>
            <div className="instagram-composer-actions">
              <Action
                disabled={busy}
                onClick={() => {
                  setReplyTo(null);
                  setMessage("");
                  setBlocked(false);
                  setMutationError("");
                  requestKey.current = "";
                }}
              >
                Kosongkan draf
              </Action>
              <Action
                primary
                type="submit"
                disabled={busy || !message.trim() || blocked}
                aria-busy={busy}
              >
                {busy ? "Mengirim…" : "Kirim balasan"}
              </Action>
            </div>
          </form>
        </div>
      )}
      <DialogFrame
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setConfirmation(null);
            setConfirmationError("");
          }
        }}
        title="Hapus komentar?"
        description="Komentar akan dihapus dari Instagram dan tidak dapat dipulihkan melalui aplikasi ini."
        contentClassName="marketing-modal marketing-small-modal instagram-studio-dialog"
        layer={10002}
        initialFocusRef={cancel}
        focusFallbackId="instagram-comments-refresh"
        hideClose={busy}
      >
        <h2>Hapus komentar?</h2>
        <p>
          <strong>@{confirmation?.comment.username}</strong>
        </p>
        <p>{confirmation?.comment.text}</p>
        <p>
          Komentar akan dihapus dari Instagram. Aplikasi ini tidak menyediakan
          pemulihan.
        </p>
        {confirmationError && (
          <p className="marketing-error" role="alert">
            {confirmationError}
          </p>
        )}
        <div className="marketing-modal-actions">
          <Action
            ref={cancel}
            disabled={busy}
            onClick={() => {
              setConfirmation(null);
              setConfirmationError("");
            }}
          >
            Batal
          </Action>
          <Action
            className="instagram-danger"
            disabled={busy}
            aria-busy={busy}
            onClick={() => {
              if (confirmation)
                void perform(
                  "delete-comment",
                  { commentId: confirmation.comment.id },
                  confirmation.requestId,
                ).then((ok) => {
                  if (ok) {
                    const id = confirmation.comment.id;
                    setComments((previous) => ({
                      ...previous,
                      items: previous.items.filter((item) => item.id !== id),
                    }));
                    setThreads((previous) =>
                      Object.fromEntries(
                        Object.entries(previous).map(([key, value]) => [
                          key,
                          {
                            ...value,
                            items: value.items.filter((item) => item.id !== id),
                          },
                        ]),
                      ),
                    );
                    setConfirmation(null);
                  }
                });
            }}
          >
            {busy ? "Menghapus…" : "Hapus komentar"}
          </Action>
        </div>
      </DialogFrame>
    </div>
  );
}
