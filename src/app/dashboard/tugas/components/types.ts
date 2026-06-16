export type Category = "URGENT" | "KONTEN" | "FOLLOWUP" | "VIEWING" | "PIPELINE" | "NETWORKING";
export type LeadTemp = "HOT" | "WARM" | "COLD";
export type ListingType = "RUMAH" | "APARTEMEN" | "RUKO" | "KAVLING" | "GUDANG";

export type DailyTask = {
  id: string;
  category: Category;
  title: string;
  why: string;
  done: boolean;
  overdue?: boolean;
  source?: "lead" | "titip" | "listing" | "acara" | "manual" | "penawaran" | "cobroke";
  sourceId?: string;
  titipStep?: number;
  offerAmount?: number;
  offerStatus?: "pending" | "diterima" | "ditolak";
  cobrokeAgentName?: string;
  cobrokeAgentOffice?: string;
  cobrokeAgentPhone?: string;
  meta?: Record<string, any>;
  target?: number;
  current?: number;
  leadName?: string;
  leadTemp?: LeadTemp;
  leadPhone?: string;
  pipelineStage?: string;
  commissionValue?: number;
  propertyTitle?: string;
  scheduledAt?: string;
  deadline?: string; // ISO — batas SLA tugas
  openCatalog?: boolean;
  actions: ActionDef[];
};

export type ActionDef = {
  label: string;
  icon: string;
  variant: "primary" | "green" | "sky" | "violet" | "amber" | "ghost" | "rose" | "pink";
  onClick: () => void;
};

export type CatalogListing = {
  id: string;
  rank: number;
  title: string;
  location: string;
  price: number;
  type: ListingType;
  bedrooms?: number;
  bathrooms?: number;
  buildArea?: number;
  landArea?: number;
  views7d: number;
  inquiries7d: number;
  potentialScore: number;
};

/* ── Database types ─────────────────────────────────────────── */

export type KategoriTugas = "URGENT" | "KONTEN" | "FOLLOWUP" | "VIEWING" | "PIPELINE" | "NETWORKING" | "UMUM";
export type StatusTugas   = "BELUM" | "DALAM_PROSES" | "SELESAI" | "DIBATALKAN";
export type PrioritasTugas = "TINGGI" | "SEDANG" | "RENDAH";

export type DbTask = {
  id_tugas:          string;
  id_agent:          string;
  judul:             string;
  catatan:           string | null;
  kategori:          KategoriTugas;
  prioritas:         PrioritasTugas;
  status:            StatusTugas;
  tanggal_mulai:     string | null;
  tanggal_selesai:   string | null;
  selesai_pada:      string | null;
  jam_terjadwal:     string | null;
  target:            number | null;
  progress:          number;
  alasan:            string | null;
  komisi_potensial:  number | null;
  id_lead:           number | null;
  id_listing:        number | null;
  id_transaksi:      string | null;
  is_overdue:        boolean;
  is_auto_generated: boolean;
  dibuat_pada:       string;
  diperbarui_pada:   string;
  lead?: {
    id_lead:      number;
    client_name:  string | null;
    client_phone: string | null;
  } | null;
  listing?: {
    id_property: number;
    judul:       string;
  } | null;
};

export type TugasFormData = {
  judul:            string;
  kategori:         KategoriTugas;
  prioritas:        PrioritasTugas;
  catatan:          string;
  alasan:           string;
  tanggal_selesai:  string;
  jam_terjadwal:    string;
  target:           string;
  komisi_potensial: string;
};

export type CatDesign = {
  label: string;
  icon: string;
  grad: string;
  orb: string;
  hairline: string;
  leftBar: string;
  iconGrad: string;
  iconRing: string;
  iconShadow: string;
  accent: string;
  sectionBg: string;
  sectionBorder: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
};
