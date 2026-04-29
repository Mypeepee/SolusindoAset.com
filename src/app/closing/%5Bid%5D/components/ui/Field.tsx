export default function Field({
    label,
    value,
    full,
  }: {
    label: string;
    value: React.ReactNode;
    full?: boolean;
  }) {
    return (
      <div className={full ? "sm:col-span-2" : ""}>
        <div className="text-xs text-zinc-400">{label}</div>
        <div className="mt-1 text-sm font-semibold text-white break-words">
          {value}
        </div>
      </div>
    );
  }