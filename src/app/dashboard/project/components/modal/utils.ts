import type {
    AcquisitionFinancials,
    BiayaBalikNamaBreakdown,
    CmaEntry,
    CreateProjectFormValues,
    CreateProjectPayload,
    FundingInvestorAllocation,
    ListingOption,
    ProjectCmaPayload,
    ProjectInvestorPayload,
    status_pembayaran_project_enum,
  } from "./types";
  
  export function formatCurrency(value?: number | null) {
    const numeric = Number(value ?? 0);
  
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(numeric) ? numeric : 0);
  }
  
  export function formatNumberDots(value?: number | null): string {
    const numeric = Number(value ?? 0);
  
    if (!Number.isFinite(numeric) || numeric <= 0) return "";
  
    return new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 0,
    }).format(Math.round(numeric));
  }
  
  export function formatPercent(value?: number | null) {
    const numeric = Number(value ?? 0);
  
    if (!Number.isFinite(numeric)) return "-";
  
    return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
  }
  
  export function parseNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  
  export function parseFormattedNumber(value: string): number {
    if (!value) return 0;
  
    const digitsOnly = String(value).replace(/[^\d]/g, "");
    if (!digitsOnly) return 0;
  
    const parsed = Number(digitsOnly);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  
  export function numberInputValue(value?: number | null): string {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : "";
  }
  
  function isLikelyGoogleDriveId(value: string) {
    return /^[A-Za-z0-9_-]{20,}$/.test(value);
  }
  
  function extractGoogleDriveId(rawUrl: string) {
    const patterns = [
      /[?&]id=([^&#]+)/i,
      /\/file\/d\/([^/]+)/i,
      /\/d\/([^/]+)/i,
      /\/thumbnail\?id=([^&#]+)/i,
      /\/uc\?(?:[^#]*&)?id=([^&#]+)/i,
    ];
  
    for (const pattern of patterns) {
      const match = rawUrl.match(pattern);
      if (match?.[1]) return match[1];
    }
  
    if (isLikelyGoogleDriveId(rawUrl)) {
      return rawUrl;
    }
  
    return null;
  }
  
  export function normalizeImageUrl(url?: string | null): string {
    if (!url) return "";
  
    const trimmed = String(url).trim();
    if (!trimmed) return "";
  
    const driveId = extractGoogleDriveId(trimmed);
    if (driveId) {
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
    }
  
    if (
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://")
    ) {
      return trimmed;
    }
  
    if (trimmed.startsWith("//")) {
      return `https:${trimmed}`;
    }
  
    if (trimmed.startsWith("/")) {
      return trimmed;
    }
  
    return trimmed;
  }
  
  export function formatCategoryLabel(value?: string | null) {
    if (!value) return "-";
  
    return String(value)
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  
  export function formatTransactionLabel(value?: string | null) {
    if (!value) return "-";
  
    return String(value)
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  
  export function formatLegalitasLabel(value?: string | null) {
    if (!value) return "-";
  
    return String(value)
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  
  export function createEmptyCmaEntry(seed: number | string): CmaEntry {
    return {
      id: `cma-${seed}-${Math.random().toString(36).slice(2, 7)}`,
      nama: "",
      luas_tanah: 0,
      harga: 0,
      catatan: "",
    };
  }
  
  export function createDefaultCmaEntries(count = 10): CmaEntry[] {
    return Array.from({ length: count }, (_, index) =>
      createEmptyCmaEntry(index + 1)
    );
  }
  
  export function createEmptyInvestorAllocation(
    seed: number | string
  ): FundingInvestorAllocation {
    return {
      id: `alloc-${seed}-${Math.random().toString(36).slice(2, 7)}`,
      investor_id: "",
      nominal: 0,
      investor_nama: "",
      investor_label: "",
      investor_avatar: "",
      status: "menunggu_pembayaran",
      catatan: "",
    };
  }
  
  export function createDefaultInvestorAllocations(
    count = 1
  ): FundingInvestorAllocation[] {
    return Array.from({ length: count }, (_, index) =>
      createEmptyInvestorAllocation(index + 1)
    );
  }
  
  export function getBiayaBalikNamaBreakdown(
    acquisitionBase: number
  ): BiayaBalikNamaBreakdown {
    const base = Number(acquisitionBase || 0);
  
    const bea_lelang = base * 0.02;
    const bphtb = base * 0.05;
    const ppn_lelang = base * 0.011;
    const roya = base * 0.001;
    const balik_nama = base * 0.002;
  
    return {
      bea_lelang,
      bphtb,
      ppn_lelang,
      roya,
      balik_nama,
      total: bea_lelang + bphtb + ppn_lelang + roya + balik_nama,
    };
  }
  
  export function getProjectAcquisitionFinancials(
    form: Pick<
      CreateProjectFormValues,
      | "harga_pembelian"
      | "nilai_limit_lelang"
      | "spare_bidding"
      | "biaya_balik_nama"
      | "biaya_eksekusi"
      | "target_pendanaan"
    >
  ): AcquisitionFinancials {
    const nilaiLimitLelang = Number(form.nilai_limit_lelang || 0);
    const hargaPembelian = Number(form.harga_pembelian || 0);
  
    const acquisition_base =
      nilaiLimitLelang > 0 ? nilaiLimitLelang : hargaPembelian;
  
    const acquisition_base_label =
      nilaiLimitLelang > 0 ? "Nilai Limit Lelang" : "Harga Pembelian";
  
    const spare_bidding = Number(form.spare_bidding || 0);
    const biaya_eksekusi = Number(form.biaya_eksekusi || 0);
    const target_pendanaan = Number(form.target_pendanaan || 0);
  
    const auto_breakdown = getBiayaBalikNamaBreakdown(acquisition_base);
    const manualBiayaBalikNama = Number(form.biaya_balik_nama || 0);
  
    const biaya_balik_nama_total =
      manualBiayaBalikNama > 0 ? manualBiayaBalikNama : auto_breakdown.total;
  
    const biaya_balik_nama = {
      ...auto_breakdown,
      total: biaya_balik_nama_total,
    };
  
    const total_biaya_akuisisi =
      acquisition_base +
      spare_bidding +
      biaya_balik_nama.total +
      biaya_eksekusi;
  
    const dana_cadangan = target_pendanaan - total_biaya_akuisisi;
  
    return {
      acquisition_base_label,
      acquisition_base,
      spare_bidding,
      biaya_balik_nama,
      biaya_eksekusi,
      total_biaya_akuisisi,
      dana_cadangan,
      target_pendanaan,
    };
  }
  
  function roundSix(value: number) {
    return Number(value.toFixed(6));
  }
  
  export function getListingIdForProject(listing?: ListingOption | null): string {
    const value = listing?.id_property ?? listing?.id_listing ?? "";
    return value ? String(value) : "";
  }
  
  export function buildProjectCmaPayload(
    entries: CmaEntry[] = []
  ): ProjectCmaPayload[] {
    return entries
      .filter((entry) => {
        const hasNama = entry.nama.trim().length > 0;
        const hasLuas = Number(entry.luas_tanah || 0) > 0;
        const hasHarga = Number(entry.harga || 0) > 0;
        const hasCatatan = String(entry.catatan || "").trim().length > 0;
  
        return hasNama || hasLuas || hasHarga || hasCatatan;
      })
      .map((entry) => ({
        nama: entry.nama.trim(),
        luas_tanah: Number(entry.luas_tanah || 0),
        harga: Number(entry.harga || 0),
        catatan: entry.catatan?.trim() || null,
      }));
  }
  
  export function buildProjectInvestorPayload(
    form: Pick<
      CreateProjectFormValues,
      "target_pendanaan" | "invitedInvestorIds" | "investor_allocations"
    >
  ): ProjectInvestorPayload[] {
    const targetPendanaan = Number(form.target_pendanaan || 0);
    const defaultStatus: status_pembayaran_project_enum = "menunggu_pembayaran";
  
    const map = new Map<string, ProjectInvestorPayload>();
  
    for (const invitedId of form.invitedInvestorIds || []) {
      const id_agent = String(invitedId || "").trim();
      if (!id_agent) continue;
  
      map.set(id_agent, {
        id_agent,
        nominal_komitmen: 0,
        nominal_terbayar: 0,
        persentase_kepemilikan: null,
        status: defaultStatus,
        catatan: null,
      });
    }
  
    for (const allocation of form.investor_allocations || []) {
      const id_agent = String(allocation.investor_id || "").trim();
      if (!id_agent) continue;
  
      const nominal_komitmen = Math.max(0, Number(allocation.nominal || 0));
      const existing = map.get(id_agent);
  
      map.set(id_agent, {
        id_agent,
        nominal_komitmen:
          Number(existing?.nominal_komitmen || 0) + nominal_komitmen,
        nominal_terbayar: 0,
        persentase_kepemilikan: null,
        status: allocation.status || existing?.status || defaultStatus,
        catatan: allocation.catatan?.trim() || existing?.catatan || null,
      });
    }
  
    return Array.from(map.values()).map((item) => ({
      ...item,
      persentase_kepemilikan:
        targetPendanaan > 0 && item.nominal_komitmen > 0
          ? roundSix((item.nominal_komitmen / targetPendanaan) * 100)
          : null,
    }));
  }
  
  export function buildCreateProjectPayload(
    form: CreateProjectFormValues
  ): CreateProjectPayload {
    const financials = getProjectAcquisitionFinancials(form);
    const investor_allocations = buildProjectInvestorPayload(form);
    const cma_entries = buildProjectCmaPayload(form.cma_entries);
  
    const derivedTotalPendanaan =
      Number(form.total_pendanaan || 0) > 0
        ? Number(form.total_pendanaan || 0)
        : investor_allocations.reduce(
            (sum, item) => sum + Number(item.nominal_komitmen || 0),
            0
          );
  
    return {
      id_listing: String(form.id_listing ?? "").trim(),
  
      nama_project: form.nama_project.trim(),
      alamat_property: form.alamat_property.trim(),
      provinsi: form.provinsi.trim(),
      kota: form.kota.trim(),
      kecamatan: form.kecamatan.trim(),
      kelurahan: form.kelurahan.trim(),
      gambar_thumbnail: normalizeImageUrl(form.gambar_thumbnail),
  
      tanggal_pembelian: form.tanggal_pembelian,
      harga_pembelian: Number(form.harga_pembelian || 0),
      estimasi_harga_jual: Number(form.estimasi_harga_jual || 0),
      estimasi_profit_bersih: Number(form.estimasi_profit_bersih || 0),
      target_pendanaan: Number(form.target_pendanaan || 0),
      total_pendanaan: Number(derivedTotalPendanaan || 0),
  
      jenis_pendanaan: form.jenis_pendanaan,
      status: form.status,
  
      mulai_tanggal: form.mulai_tanggal,
      estimasi_selesai: form.estimasi_selesai,
      estimasi_bulan: Number(form.estimasi_bulan || 0),
      pendanaan_ditutup_pada: form.pendanaan_ditutup_pada,
  
      deskripsi_project: form.deskripsi_project.trim(),
      dibuat_oleh: String(form.dibuat_oleh || "").trim(),
  
      nilai_limit_lelang: Number(form.nilai_limit_lelang || 0),
      spare_bidding: Number(form.spare_bidding || 0),
      biaya_balik_nama: Number(financials.biaya_balik_nama.total || 0),
      biaya_eksekusi: Number(form.biaya_eksekusi || 0),
      biaya_renov: Number(form.biaya_renov || 0),
      total_biaya_akuisisi: Number(financials.total_biaya_akuisisi || 0),
      dana_cadangan: Number(financials.dana_cadangan || 0),
  
      investor_allocations,
      cma_entries,
    };
  }
  
  export function getInitialForm(
    createdById?: string
  ): CreateProjectFormValues {
    return {
      id_listing: null,
  
      nama_project: "",
      alamat_property: "",
      provinsi: "",
      kota: "",
      kecamatan: "",
      kelurahan: "",
      gambar_thumbnail: "",
  
      tanggal_pembelian: null,
      harga_pembelian: 0,
      estimasi_harga_jual: 0,
      estimasi_profit_bersih: 0,
      target_pendanaan: 0,
      total_pendanaan: 0,
  
      jenis_pendanaan: "terbuka",
      status: "pendanaan_terbuka",
  
      mulai_tanggal: null,
      estimasi_selesai: null,
      estimasi_bulan: 0,
      pendanaan_ditutup_pada: null,
  
      deskripsi_project: "",
      dibuat_oleh: createdById || "",
      invitedInvestorIds: [],
  
      nilai_limit_lelang: 0,
      spare_bidding: 0,
      biaya_balik_nama: 0,
      biaya_eksekusi: 0,
      biaya_renov: 0,
      total_biaya_akuisisi: 0,
      dana_cadangan: 0,
  
      cma_entries: createDefaultCmaEntries(10),
      investor_allocations: createDefaultInvestorAllocations(1),
    };
  }