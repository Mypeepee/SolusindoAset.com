import { LoaderCircle } from "lucide-react";

export default function InvestorLoading() {
  return (
    <div
      role="status"
      className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-slate-300"
    >
      <LoaderCircle
        size={22}
        className="animate-spin motion-reduce:animate-none text-emerald-300"
      />
      Memuat Investor Deals…
    </div>
  );
}
