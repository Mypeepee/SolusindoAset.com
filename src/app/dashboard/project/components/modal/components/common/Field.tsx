type Props = {
    label: string;
    icon?: React.ElementType;
    children: React.ReactNode;
    helper?: string;
  };
  
  export default function Field({
    label,
    icon: Icon,
    children,
    helper,
  }: Props) {
    return (
      <label className="block">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
          {Icon ? <Icon className="h-4 w-4 text-white/80" /> : null}
          <span>{label}</span>
        </div>
        {children}
        {helper ? (
          <p className="mt-2 text-xs leading-5 text-slate-400">{helper}</p>
        ) : null}
      </label>
    );
  }