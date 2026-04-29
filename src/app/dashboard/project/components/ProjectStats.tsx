type StatItem = {
  label: string;
  value: string;
  helper?: string;
};

export default function ProjectStats({
  items,
}: {
  items: StatItem[];
}) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_14px_44px_rgba(0,0,0,0.2)] backdrop-blur-sm"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
            {item.label}
          </p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-white">
            {item.value}
          </p>
          {item.helper ? (
            <p className="mt-2 text-sm leading-6 text-white/60">{item.helper}</p>
          ) : null}
        </div>
      ))}
    </section>
  );
}