"use client";

export default function ClosingActionBar({
  onSaveDraft,
  onFinalize,
}: {
  onSaveDraft: () => void;
  onFinalize: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-40 -mx-4 mt-6 border-t border-white/10 bg-zinc-950/75 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1060px] items-center justify-between gap-3">
        <div className="text-xs text-zinc-400">
          Auto-save bisa ditambah nanti. Untuk sekarang: simpan draft dulu.
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSaveDraft}
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-200 hover:bg-white/10"
          >
            Simpan Draft
          </button>
          <button
            type="button"
            onClick={onFinalize}
            className="h-11 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Finalize Closing
          </button>
        </div>
      </div>
    </div>
  );
}