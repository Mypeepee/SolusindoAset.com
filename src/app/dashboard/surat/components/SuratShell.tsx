import type { ReactNode } from "react";

type Props = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function SuratShell({ sidebar, children }: Props) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <aside className="hidden w-[290px] shrink-0 xl:block">
          {sidebar}
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}