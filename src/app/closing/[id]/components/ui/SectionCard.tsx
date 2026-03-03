export default function SectionCard({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="mb-4">
          <div className="text-sm font-semibold text-white">{title}</div>
          {subtitle ? <div className="text-xs text-zinc-400 mt-1">{subtitle}</div> : null}
        </div>
        {children}
      </div>
    );
  }