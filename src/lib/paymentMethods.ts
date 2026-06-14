export type PaymentMethod = "cash" | "kpr";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; waLabel: string; icon: string }[] = [
  { value: "cash", label: "Cash", waLabel: "Tunai (Cash)",     icon: "solar:wallet-money-bold-duotone" },
  { value: "kpr",  label: "KPR",  waLabel: "KPR / Kredit Bank", icon: "solar:bill-check-bold-duotone" },
];
