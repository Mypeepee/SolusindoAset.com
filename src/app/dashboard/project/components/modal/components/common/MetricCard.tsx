type Props = {
    label: string;
    value: string;
    helper: string;
    accentText: string;
  };
  
  export default function MetricCard({
    label,
    value,
    helper,
    accentText,
  }: Props) {
    return (
      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-lg font-black text-white">{value}</p>
        <p className={`mt-2 text-xs leading-5 ${accentText}`}>{helper}</p>
      </div>
    );
  }