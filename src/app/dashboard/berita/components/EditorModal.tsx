"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { FileWarning, Loader2 } from "lucide-react";
import WorkspaceDialog from "./WorkspaceDialog";
import styles from "./workspace.module.css";

const BeritaEditor = dynamic(() => import("./BeritaEditor"), {
  loading: () => (
    <div className={styles.editorLoading}>
      <Loader2 className="animate-spin" /> Menyiapkan editor…
    </div>
  ),
});

export default function EditorModal({
  target,
  onClose,
  onSaved,
}: {
  target: { id?: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  }, [dirty, saving, onClose]);
  const close = () => {
    setDirty(false);
    setConfirmClose(false);
    onClose();
  };
  return (
    <>
      <WorkspaceDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
        title={target?.id ? "Edit berita" : "Tulis berita"}
        description="Ruang menulis artikel, media, SEO, dan pengaturan publikasi."
        variant="editor"
        hideClose
      >
        {target && (
          <BeritaEditor
            key={target.id || "new"}
            id={target.id}
            embedded
            onDirtyChange={setDirty}
            onSavingChange={setSaving}
            onCancel={requestClose}
            onSaved={() => {
              setDirty(false);
              onSaved();
            }}
          />
        )}
      </WorkspaceDialog>
      <WorkspaceDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Tutup tanpa menyimpan?"
        description="Perubahan artikel yang belum disimpan akan hilang."
      >
        <div className={styles.confirmBody}>
          <span className={styles.confirmIcon}>
            <FileWarning size={24} />
          </span>
          <h2>Masih ada cerita yang belum disimpan.</h2>
          <p>
            Perubahan terakhir belum tersimpan. Kembali menulis atau tutup
            editor dan abaikan perubahan.
          </p>
          <div className={styles.confirmButtons}>
            <button
              className={styles.secondaryButton}
              onClick={() => setConfirmClose(false)}
            >
              Lanjut menulis
            </button>
            <button className={styles.dangerButton} onClick={close}>
              Tutup tanpa menyimpan
            </button>
          </div>
        </div>
      </WorkspaceDialog>
    </>
  );
}
