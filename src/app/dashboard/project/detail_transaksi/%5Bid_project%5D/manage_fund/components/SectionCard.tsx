import type { ReactNode } from "react";

export default function SectionCard({
  title,
  description,
  action,
  className = "",
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-3xl border border-white/10 bg-[#0b1220] shadow-[0_20px_60px_rgba(0,0,0,0.25)] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-white/60">{description}</p>
          ) : null}
        </div>

        {action ? <div>{action}</div> : null}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}