export default function Money({ value }: { value: number | string | null | undefined }) {
    const n = Number(value ?? 0);
    const text = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(isFinite(n) ? n : 0);
  
    return <span>{text}</span>;
  }