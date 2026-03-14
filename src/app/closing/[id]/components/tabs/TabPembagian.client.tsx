"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Listing, Agent } from "../../page";
import type { SkemaPenjualan } from "./TabTransaksi.client";
import Money from "../ui/Money";
import { Icon } from "@iconify/react";

/* =========================================
  Types
========================================= */
type AgentOption = {
  id_agent?: string | number | null;
  id?: string | number | null;
  nama?: string | null;
  name?: string | null;
  kantor?: string | null;
  office?: string | null;
  kantor_nama?: string | null;
};

type PersistedState = {
  step: 1 | 2 | 3;
  deal: number;
  bidding: number;
  komisiStr: string;

  balikNamaMode: "AUTO" | "MANUAL";
  balikNama: number;
  eksekusi: number;

  includeBalikNama: boolean;
  includeEksekusi: boolean;

  cobroke: number;

  selisihKotor: number;
  selisihSebelumRoyalty: number;
  royaltyFee: number;
  selisihFinal: number;
};

type SplitRow = {
  id: string;
  code: string;
  label: string;
  percent: number;
  agentId: string;
};

type SavePayload = {
  selisihFinal: number;
  rows: Array<{
    code: string;
    label: string;
    percent: number;
    nominal: number;
    agentId: string;
    agentName: string;
    agentOffice: string;
  }>;
};

type Props = {
  listing: Listing;
  agent: Agent | null;
  skemaPenjualan: SkemaPenjualan;
  agents?: AgentOption[];
  teamLeaderName?: string;
  onSave?: (payload: SavePayload) => void;
};

type AgentCatalogItem = {
  id: string;
  name: string;
  office: string;
  label: string;
};

type StoredLegacyRow = {
  id?: string;
  code?: string;
  label?: string;
  percent?: number | string;
  agentId?: string;
  agentName?: string;
};

type SnapshotTone =
  | "blue"
  | "violet"
  | "amber"
  | "rose"
  | "cyan"
  | "emerald"
  | "indigo"
  | "fuchsia"
  | "final";

/* =========================================
  Helpers
========================================= */
function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function clamp(value: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function uid(prefix = "row") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function storageKeyTransaksi(listing: Listing) {
  return `closing:transaksi:${String(
    (listing as any)?.id_property ?? listing?.id_property ?? ""
  )}`;
}

function storageKeyPembagian(listing: Listing) {
  return `closing:pembagian:${String(
    (listing as any)?.id_property ?? listing?.id_property ?? ""
  )}`;
}

function getAgentId(item: AgentOption | Agent | null | undefined) {
  const raw =
    (item as any)?.id_agent ??
    (item as any)?.id ??
    (item as any)?.kode ??
    "";
  return String(raw ?? "").trim();
}

function getAgentName(item: AgentOption | Agent | null | undefined) {
  const raw =
    (item as any)?.nama ??
    (item as any)?.name ??
    (item as any)?.full_name ??
    "";
  return String(raw ?? "").trim();
}

function getAgentOffice(item: AgentOption | Agent | null | undefined) {
  const raw =
    (item as any)?.kantor ??
    (item as any)?.office ??
    (item as any)?.kantor_nama ??
    "";
  return String(raw ?? "").trim();
}

function buildAgentLabel(name: string, office: string) {
  return `${name || "-"} | ${office || "-"}`;
}

function findAgentIdByName(agents: AgentCatalogItem[], name: string): string {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return "";
  const found = agents.find((a) => a.name.trim().toLowerCase() === key);
  return found?.id ?? "";
}

function normalizeStoredRows(
  rawRows: unknown,
  defaults: SplitRow[],
  agents: AgentCatalogItem[]
): SplitRow[] {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return defaults;

  const rows = rawRows
    .map((item, index): SplitRow | null => {
      const row = item as StoredLegacyRow;

      const code = String(row?.code ?? "").trim();
      const label = String(row?.label ?? "").trim();
      const percent = n(row?.percent);

      if (!code || !label) return null;

      let agentId = String(row?.agentId ?? "").trim();
      if (!agentId && row?.agentName) {
        agentId = findAgentIdByName(agents, row.agentName);
      }

      return {
        id: String(row?.id ?? uid(`stored-${index}`)),
        code,
        label,
        percent,
        agentId,
      };
    })
    .filter(Boolean) as SplitRow[];

  return rows.length > 0 ? rows : defaults;
}

function sanitizeDecimalInput(raw: string) {
  const normalized = String(raw ?? "").replace(/,/g, ".");
  let out = "";
  let dotSeen = false;

  for (const ch of normalized) {
    if (/\d/.test(ch)) {
      out += ch;
      continue;
    }
    if (ch === "." && !dotSeen) {
      dotSeen = true;
      out += ch;
    }
  }

  return out;
}

function parseDecimalInput(raw: string) {
  const cleaned = sanitizeDecimalInput(raw);
  if (!cleaned || cleaned === ".") return 0;
  return clamp(Number(cleaned), 0);
}

function formatPercentDisplay(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number(value)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function getNextCustomCode(rows: SplitRow[]) {
  const nextIndex =
    rows.filter((row) =>
      row.code.trim().toUpperCase().startsWith("CUSTOM_")
    ).length + 1;

  return `CUSTOM_${nextIndex}`;
}

/* =========================================
  Default Template
========================================= */
const DEFAULT_TEMPLATE: Array<{
  code: string;
  label: string;
  percent: number;
  defaultAgent?: "CLOSING_AGENT" | "TEAM_LEADER" | "";
}> = [
  { code: "UP1", label: "Upline 1", percent: 0.4 },
  { code: "UP2", label: "Upline 2", percent: 0.3 },
  { code: "UP3", label: "Upline 3", percent: 0.2 },
  { code: "LISTER", label: "Lister", percent: 1, defaultAgent: "CLOSING_AGENT" },
  { code: "COPIC", label: "CO PIC", percent: 0.25 },
  { code: "CONS", label: "Consultant", percent: 0.85 },
  { code: "REWARD", label: "Reward Fund", percent: 3 },
  { code: "INV_FUND", label: "Investment Fund", percent: 2 },
  { code: "PROMO_FUND", label: "Promotion Fund", percent: 2 },
  { code: "PIC1", label: "PIC 1", percent: 4 },
  { code: "PIC2", label: "PIC 2", percent: 4 },
  { code: "PIC3", label: "PIC 3", percent: 4 },
  { code: "PIC4", label: "PIC 4", percent: 4 },
  { code: "PIC5", label: "PIC 5", percent: 4 },
  { code: "THC", label: "THC", percent: 40, defaultAgent: "CLOSING_AGENT" },
  { code: "SERVICE", label: "Service Fund", percent: 10 },
  { code: "FEE_TL", label: "Fee Team Leader", percent: 0, defaultAgent: "TEAM_LEADER" },
  { code: "PRINC_FEE", label: "Principal Fee", percent: 3 },
  { code: "INV_SHARE", label: "Investor Sharing", percent: 9.52 },
  { code: "MGMT_FUND1", label: "Management Fund 1", percent: 2.97 },
  { code: "MGMT_FUND2", label: "Management Fund 2", percent: 2.98 },
  { code: "EMP_INC", label: "Employee Incentive", percent: 1.53 },
];

function buildDefaultRows(
  closingAgentId: string,
  teamLeaderAgentId: string
): SplitRow[] {
  return DEFAULT_TEMPLATE.map((item) => ({
    id: uid(item.code.toLowerCase()),
    code: item.code,
    label: item.label,
    percent: item.percent,
    agentId:
      item.defaultAgent === "CLOSING_AGENT"
        ? closingAgentId
        : item.defaultAgent === "TEAM_LEADER"
        ? teamLeaderAgentId
        : "",
  }));
}

/* =========================================
  Main
========================================= */
export default function TabPembagian({
  listing,
  agent,
  skemaPenjualan,
  agents = [],
  teamLeaderName = "",
  onSave,
}: Props) {
  const transaksiKey = storageKeyTransaksi(listing);
  const pembagianKey = storageKeyPembagian(listing);

  const [loadedTransaksi, setLoadedTransaksi] = useState(false);
  const [loadedPembagian, setLoadedPembagian] = useState(false);

  const [persisted, setPersisted] = useState<PersistedState | null>(null);
  const [rows, setRows] = useState<SplitRow[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPercentInput, setNewPercentInput] = useState("0");
  const [newAgentId, setNewAgentId] = useState("");

  const hydratedPembagianKeyRef = useRef<string>("");

  const agentCatalog = useMemo<AgentCatalogItem[]>(() => {
    const map = new Map<string, AgentCatalogItem>();

    for (const item of agents) {
      const name = getAgentName(item);
      if (!name) continue;

      const office = getAgentOffice(item);
      const rawId = getAgentId(item);
      const id = rawId || `TEMP:${name}|${office}`;

      if (!map.has(id)) {
        map.set(id, {
          id,
          name,
          office,
          label: buildAgentLabel(name, office),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "id-ID")
    );
  }, [agents]);

  const closingAgentId = useMemo(() => {
    const raw = getAgentId(agent);
    if (raw) return raw;
    const name = getAgentName(agent);
    return findAgentIdByName(agentCatalog, name);
  }, [agent, agentCatalog]);

  const teamLeaderAgentId = useMemo(() => {
    return findAgentIdByName(agentCatalog, teamLeaderName);
  }, [agentCatalog, teamLeaderName]);

  const defaultRows = useMemo(
    () => buildDefaultRows(closingAgentId, teamLeaderAgentId),
    [closingAgentId, teamLeaderAgentId]
  );

  useEffect(() => {
    setLoadedTransaksi(false);

    try {
      const raw = localStorage.getItem(transaksiKey);
      if (raw) {
        setPersisted(JSON.parse(raw) as PersistedState);
      } else {
        setPersisted(null);
      }
    } catch {
      setPersisted(null);
    } finally {
      setLoadedTransaksi(true);
    }
  }, [transaksiKey]);

  useEffect(() => {
    if (hydratedPembagianKeyRef.current === pembagianKey) return;

    hydratedPembagianKeyRef.current = pembagianKey;
    setLoadedPembagian(false);

    try {
      const raw = localStorage.getItem(pembagianKey);
      if (raw) {
        setRows(normalizeStoredRows(JSON.parse(raw), defaultRows, agentCatalog));
      } else {
        setRows(defaultRows);
      }
    } catch {
      setRows(defaultRows);
    } finally {
      setLoadedPembagian(true);
    }
  }, [pembagianKey, defaultRows, agentCatalog]);

  useEffect(() => {
    function onUpdated(ev: Event) {
      const e = ev as CustomEvent<{ key: string; payload: PersistedState }>;
      if (e.detail?.key !== transaksiKey) return;
      setPersisted(e.detail.payload);
    }

    function onStorage(ev: StorageEvent) {
      if (ev.key !== transaksiKey) return;
      try {
        if (ev.newValue) {
          setPersisted(JSON.parse(ev.newValue) as PersistedState);
        } else {
          setPersisted(null);
        }
      } catch {
        setPersisted(null);
      }
    }

    window.addEventListener("closing:transaksi-updated", onUpdated);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("closing:transaksi-updated", onUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [transaksiKey]);

  useEffect(() => {
    if (!loadedPembagian) return;
    try {
      localStorage.setItem(pembagianKey, JSON.stringify(rows));
    } catch {
      // ignore
    }
  }, [loadedPembagian, pembagianKey, rows]);

  const selisihFinal = n(persisted?.selisihFinal);
  const royaltyFee = n(persisted?.royaltyFee);
  const selisihKotor = n(persisted?.selisihKotor);
  const selisihSebelumRoyalty = n(persisted?.selisihSebelumRoyalty);
  const deal = n(persisted?.deal);
  const bidding = n(persisted?.bidding);
  const balikNama = n(persisted?.balikNama);
  const eksekusi = n(persisted?.eksekusi);
  const cobroke = n(persisted?.cobroke);

  const transaksiReady = loadedTransaksi && selisihFinal > 0;

  const totalPercent = useMemo(() => {
    return Number(rows.reduce((sum, row) => sum + n(row.percent), 0).toFixed(2));
  }, [rows]);

  const isTotalValid = Math.abs(totalPercent - 100) < 0.01;

  const rowsWithNominal = useMemo(() => {
    if (!rows.length) return [];

    if (!isTotalValid) {
      return rows.map((row) => ({
        ...row,
        nominal: Math.round(selisihFinal * (n(row.percent) / 100)),
      }));
    }

    let used = 0;

    return rows.map((row, index) => {
      if (index === rows.length - 1) {
        return {
          ...row,
          nominal: Math.max(0, selisihFinal - used),
        };
      }

      const nominal = Math.round(selisihFinal * (n(row.percent) / 100));
      used += nominal;

      return {
        ...row,
        nominal,
      };
    });
  }, [rows, selisihFinal, isTotalValid]);

  function getAgentById(agentId: string) {
    return agentCatalog.find((item) => item.id === agentId);
  }

  function updateRow(id: string, patch: Partial<SplitRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  function resetTemplate() {
    setRows(defaultRows);
  }

  function openAddModal() {
    setNewLabel("");
    setNewPercentInput("0");
    setNewAgentId("");
    setIsAddModalOpen(true);
  }

  function closeAddModal() {
    setIsAddModalOpen(false);
  }

  function submitAddRow() {
    const label = String(newLabel || "").trim();
    const percent = parseDecimalInput(newPercentInput);

    if (!label) {
      alert("Nama pos wajib diisi.");
      return;
    }

    const nextRow: SplitRow = {
      id: uid("custom"),
      code: getNextCustomCode(rows),
      label,
      percent,
      agentId: newAgentId,
    };

    setRows((prev) => [...prev, nextRow]);
    setIsAddModalOpen(false);
  }

  function handleSave() {
    if (!isTotalValid) {
      alert("Total porsi harus tepat 100% sebelum disimpan.");
      return;
    }

    const payload: SavePayload = {
      selisihFinal,
      rows: rowsWithNominal.map((row) => {
        const agentInfo = getAgentById(row.agentId);

        return {
          code: row.code,
          label: row.label,
          percent: row.percent,
          nominal: row.nominal,
          agentId: row.agentId,
          agentName: agentInfo?.name ?? "",
          agentOffice: agentInfo?.office ?? "",
        };
      }),
    };

    if (onSave) {
      onSave(payload);
      return;
    }

    console.log("SAVE PEMBAGIAN", payload);
    alert("Payload pembagian siap disimpan.");
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <LuxePanel
            title="Detail Pembagian"
            right={
              transaksiReady ? (
                <div className="min-w-0">
                  <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:flex xl:flex-nowrap xl:items-center xl:justify-end xl:gap-3">
                    <InfoPill
                      icon="solar:percent-circle-linear"
                      label={`${formatPercentDisplay(totalPercent)}%`}
                      tone={
                        isTotalValid
                          ? "success"
                          : totalPercent > 100
                          ? "danger"
                          : "warning"
                      }
                      className="xl:min-w-[150px] xl:w-auto"
                    />
                    <InfoPill
                      icon="solar:wallet-money-linear"
                      label={<Money value={selisihFinal} />}
                      className="xl:min-w-[240px] xl:w-auto"
                    />
                    <ActionButton
                      onClick={openAddModal}
                      icon="solar:add-circle-linear"
                      tone="primary"
                      title="Tambah Pos"
                      compactOnDesktop
                      className="sm:col-span-2 md:col-span-3 xl:h-11 xl:w-11 xl:min-w-11 xl:px-0"
                    >
                      Tambah Pos
                    </ActionButton>
                  </div>
                </div>
              ) : null
            }
          >
            {!loadedTransaksi ? (
              <EmptyState
                title="Memuat Selisih Final..."
                desc="Sedang membaca hasil transaksi terakhir."
              />
            ) : !transaksiReady ? (
              <NotReadyCard value={selisihFinal} />
            ) : (
              <>
                <div className="mt-1 overflow-hidden rounded-[28px] bg-[#09101a] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
                  <div className="hidden grid-cols-[1.55fr_0.95fr_1fr_1.45fr_56px] gap-3 bg-[linear-gradient(180deg,#0d1623_0%,#0b131f_100%)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 md:grid">
                    <div>Pos</div>
                    <div>Porsi</div>
                    <div>Nominal</div>
                    <div>Nama Agent</div>
                    <div />
                  </div>

                  <div className="divide-y divide-zinc-900/90">
                    {rowsWithNominal.map((row) => {
                      const agentInfo = getAgentById(row.agentId);

                      return (
                        <div
                          key={row.id}
                          className="px-4 py-4 md:grid md:grid-cols-[1.55fr_0.95fr_1fr_1.45fr_56px] md:gap-3 md:px-5"
                          style={{
                            background:
                              "linear-gradient(180deg, rgba(11,16,26,0.88), rgba(8,12,19,0.94))",
                          }}
                        >
                          <div className="space-y-4 md:hidden">
                            <MobileField label="Pos">
                              <RowIdentity label={row.label} />
                            </MobileField>

                            <MobileField label="Porsi (%)">
                              <PercentField
                                value={row.percent}
                                onChange={(value) =>
                                  updateRow(row.id, { percent: value })
                                }
                              />
                            </MobileField>

                            <MobileField label="Nominal">
                              <ValueField>
                                <Money value={row.nominal} />
                              </ValueField>
                            </MobileField>

                            <MobileField label="Nama Agent">
                              <AgentSelect
                                options={agentCatalog}
                                value={row.agentId}
                                onChange={(value) =>
                                  updateRow(row.id, { agentId: value })
                                }
                              />
                            </MobileField>

                            <div className="flex justify-end">
                              <DangerIconButton
                                onClick={() => removeRow(row.id)}
                                title="Hapus pos"
                              />
                            </div>
                          </div>

                          <div className="hidden md:flex md:items-center">
                            <RowIdentity label={row.label} />
                          </div>

                          <div className="hidden md:block">
                            <PercentField
                              value={row.percent}
                              onChange={(value) =>
                                updateRow(row.id, { percent: value })
                              }
                            />
                          </div>

                          <div className="hidden md:block">
                            <ValueField>
                              <Money value={row.nominal} />
                            </ValueField>
                          </div>

                          <div className="hidden md:block">
                            <AgentSelect
                              options={agentCatalog}
                              value={row.agentId}
                              onChange={(value) =>
                                updateRow(row.id, { agentId: value })
                              }
                            />
                            {agentInfo ? (
                              <div className="mt-2 truncate text-xs text-zinc-500">
                                {agentInfo.name} • {agentInfo.office || "-"}
                              </div>
                            ) : null}
                          </div>

                          <div className="hidden items-center justify-end md:flex">
                            <DangerIconButton
                              onClick={() => removeRow(row.id)}
                              title="Hapus pos"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <ActionButton
                    onClick={resetTemplate}
                    icon="solar:restart-linear"
                    tone="secondary"
                  >
                    Reset Template
                  </ActionButton>

                  <ActionButton
                    onClick={handleSave}
                    icon="solar:diskette-linear"
                    tone="primary"
                    disabled={!isTotalValid}
                  >
                    Simpan Pembagian
                  </ActionButton>
                </div>
              </>
            )}
          </LuxePanel>
        </div>

        <div className="xl:col-span-4">
          <div className="space-y-6 xl:sticky xl:top-4">
            <SnapshotPanel
              title="Snapshot Transaksi"
              subtitle={`Detail Pos`}
            >
              <SnapshotRow
                label="Harga Deal"
                value={<Money value={deal} />}
                tone="blue"
              />
              <SnapshotRow
                label="Harga Bidding"
                value={<Money value={bidding} />}
                tone="violet"
              />
              <SnapshotRow
                label="Balik Nama"
                value={<Money value={balikNama} />}
                tone="amber"
              />
              <SnapshotRow
                label="Eksekusi"
                value={<Money value={eksekusi} />}
                tone="rose"
              />
              <SnapshotRow
                label="Cobroke"
                value={<Money value={cobroke} />}
                tone="cyan"
              />
              <SnapshotRow
                label="Selisih Kotor"
                value={<Money value={selisihKotor} />}
                tone="emerald"
              />
              <SnapshotRow
                label="Sebelum Royalty"
                value={<Money value={selisihSebelumRoyalty} />}
                tone="indigo"
              />
              <SnapshotRow
                label="Royalty Fee"
                value={<Money value={royaltyFee} />}
                tone="fuchsia"
              />
              <div className="h-px bg-zinc-900" />
              <SnapshotRow
                label="Selisih Final"
                value={<Money value={selisihFinal} />}
                strong
                tone="final"
              />
              <div className="pt-2 text-xs leading-6 text-zinc-500">
                Angka <span className="font-semibold text-zinc-300">Selisih Final</span> dari
                transaksi akan dibagi ke tabel di sebelah kiri.
              </div>
            </SnapshotPanel>
          </div>
        </div>
      </div>

      <AddPosModal
        open={isAddModalOpen}
        onClose={closeAddModal}
        onSubmit={submitAddRow}
        label={newLabel}
        setLabel={setNewLabel}
        percentInput={newPercentInput}
        setPercentInput={setNewPercentInput}
        agentId={newAgentId}
        setAgentId={setNewAgentId}
        agents={agentCatalog}
      />
    </>
  );
}

/* =========================================
  UI
========================================= */
function LuxePanel({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[34px] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_18%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_18%),linear-gradient(180deg,#0d1320_0%,#080c14_100%)] px-5 py-5 shadow-[0_30px_90px_rgba(0,0,0,0.48)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent" />

      <div className="relative grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-center">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-tight text-white md:text-[2.1rem] md:leading-[1.1] xl:text-[2.05rem]">
            {title}
          </h3>
        </div>

        <div className="min-w-0">{right}</div>
      </div>

      <div className="relative mt-5">{children}</div>
    </section>
  );
}

function SnapshotPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <aside className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.10),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_20%),linear-gradient(180deg,#0c111c_0%,#080b12_100%)] px-5 py-5 shadow-[0_25px_80px_rgba(0,0,0,0.44)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/14 to-transparent" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-white">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-zinc-400">{subtitle}</div> : null}
          </div>

          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <Icon icon="solar:document-text-linear" className="text-2xl" />
          </div>
        </div>

        <div className="mt-5 space-y-3">{children}</div>
      </div>
    </aside>
  );
}

function SnapshotRow({
  label,
  value,
  strong = false,
  tone = "blue",
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  tone?: SnapshotTone;
}) {
  const toneClass =
    tone === "blue"
      ? "bg-[linear-gradient(90deg,rgba(59,130,246,0.12),rgba(255,255,255,0.02))]"
      : tone === "violet"
      ? "bg-[linear-gradient(90deg,rgba(139,92,246,0.12),rgba(255,255,255,0.02))]"
      : tone === "amber"
      ? "bg-[linear-gradient(90deg,rgba(245,158,11,0.12),rgba(255,255,255,0.02))]"
      : tone === "rose"
      ? "bg-[linear-gradient(90deg,rgba(244,63,94,0.12),rgba(255,255,255,0.02))]"
      : tone === "cyan"
      ? "bg-[linear-gradient(90deg,rgba(34,211,238,0.12),rgba(255,255,255,0.02))]"
      : tone === "emerald"
      ? "bg-[linear-gradient(90deg,rgba(16,185,129,0.12),rgba(255,255,255,0.02))]"
      : tone === "indigo"
      ? "bg-[linear-gradient(90deg,rgba(99,102,241,0.12),rgba(255,255,255,0.02))]"
      : tone === "fuchsia"
      ? "bg-[linear-gradient(90deg,rgba(217,70,239,0.12),rgba(255,255,255,0.02))]"
      : "bg-[linear-gradient(90deg,rgba(16,185,129,0.16),rgba(34,211,238,0.08),rgba(255,255,255,0.02))]";

  return (
    <div
      className={[
        "flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        toneClass,
      ].join(" ")}
    >
      <div className={strong ? "text-sm font-semibold text-zinc-200" : "text-sm text-zinc-400"}>
        {label}
      </div>
      <div className={strong ? "text-sm font-semibold text-white" : "text-sm text-zinc-200"}>
        {value}
      </div>
    </div>
  );
}

function InfoPill({
  icon,
  label,
  tone = "default",
  className = "",
}: {
  icon: string;
  label: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/12 text-emerald-100"
      : tone === "warning"
      ? "bg-amber-500/12 text-amber-100"
      : tone === "danger"
      ? "bg-red-500/12 text-red-100"
      : "bg-white/[0.05] text-zinc-200";

  return (
    <div
      className={[
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        toneClass,
        className,
      ].join(" ")}
    >
      <Icon icon={icon} className="shrink-0 text-lg" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function EmptyState({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-[28px] bg-white/[0.025] px-8 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="text-lg font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-zinc-400">{desc}</div>
    </div>
  );
}

function NotReadyCard({ value }: { value: number }) {
  return (
    <div className="rounded-[30px] bg-[linear-gradient(180deg,rgba(245,158,11,0.10),rgba(255,255,255,0.02))] px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-500/12 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <Icon icon="solar:shield-warning-linear" className="text-3xl" />
        </div>

        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-amber-100/70">
            Selisih Final
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">
            <Money value={value} />
          </div>
          <div className="mt-3 text-sm leading-6 text-amber-50/80">
            Tabel pembagian belum aktif. Lengkapi dulu tab transaksi sampai menghasilkan
            <span className="font-semibold text-white"> Selisih Final</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

function RowIdentity({
  label,
}: {
  label: string;
}) {
  return (
    <div className="max-w-full">
      <div className="inline-flex max-w-full items-center rounded-2xl bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}

function MobileField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      {children}
    </div>
  );
}

function PercentField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(formatPercentDisplay(value));

  useEffect(() => {
    setDraft(formatPercentDisplay(value));
  }, [value]);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          const next = sanitizeDecimalInput(e.target.value);
          setDraft(next);
        }}
        onBlur={() => {
          const parsed = parseDecimalInput(draft);
          onChange(parsed);
          setDraft(formatPercentDisplay(parsed));
        }}
        className="h-12 w-full rounded-2xl bg-[#101824] px-4 pr-10 text-base font-semibold text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition placeholder:text-zinc-500 focus:bg-[#131d2b] md:text-sm"
        placeholder="0"
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-500">
        %
      </span>
    </div>
  );
}

function ValueField({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-12 items-center rounded-2xl bg-[#0f1622] px-4 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:text-sm">
      {children}
    </div>
  );
}

function AgentSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AgentCatalogItem[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-2xl bg-[#101824] px-4 text-sm text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus:bg-[#131d2b]"
    >
      <option value="" className="bg-[#101824] text-white">
        Pilih agent
      </option>
      {options.map((item) => (
        <option key={item.id} value={item.id} className="bg-[#101824] text-white">
          {item.label}
        </option>
      ))}
    </select>
  );
}

function DangerIconButton({
  onClick,
  title,
}: {
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-100 transition hover:bg-red-500/15"
    >
      <Icon icon="solar:trash-bin-minimalistic-linear" className="text-xl" />
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  icon,
  tone,
  disabled = false,
  className = "",
  title,
  compactOnDesktop = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: string;
  tone: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
  title?: string;
  compactOnDesktop?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition",
        disabled
          ? "cursor-not-allowed bg-zinc-800 text-zinc-500 opacity-70"
          : tone === "primary"
          ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-[0_12px_32px_rgba(34,211,238,0.22)] hover:opacity-95"
          : "bg-white/[0.05] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:bg-white/[0.07]",
        className,
      ].join(" ")}
    >
      {icon ? <Icon icon={icon} className="shrink-0 text-lg" /> : null}
      <span className={compactOnDesktop ? "whitespace-nowrap xl:hidden" : "whitespace-nowrap"}>
        {children}
      </span>
    </button>
  );
}

function AddPosModal({
  open,
  onClose,
  onSubmit,
  label,
  setLabel,
  percentInput,
  setPercentInput,
  agentId,
  setAgentId,
  agents,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  label: string;
  setLabel: (v: string) => void;
  percentInput: string;
  setPercentInput: (v: string) => void;
  agentId: string;
  setAgentId: (v: string) => void;
  agents: AgentCatalogItem[];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_20%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.10),transparent_20%),linear-gradient(180deg,#0e1521_0%,#090d15_100%)] shadow-[0_35px_120px_rgba(0,0,0,0.58)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:34px_34px]" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
            <div>
              <div className="text-xl font-semibold text-white">Tambah Pos Baru</div>
              <div className="mt-1 text-sm leading-6 text-zinc-400">
                Tambahkan nama pos baru, tentukan porsi, lalu pilih agent penerima.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-zinc-200 transition hover:bg-white/[0.07]"
            >
              <Icon icon="solar:close-circle-linear" className="text-xl" />
            </button>
          </div>

          <div className="grid gap-5 px-5 pb-5 sm:px-6">
            <FormField label="Nama Pos">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Contoh: Bonus Marketing"
                className="h-12 w-full rounded-2xl bg-[#101824] px-4 text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition placeholder:text-zinc-500 focus:bg-[#131d2b]"
              />
            </FormField>

            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Porsi (%)">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={percentInput}
                    onChange={(e) => setPercentInput(sanitizeDecimalInput(e.target.value))}
                    placeholder="0"
                    className="h-12 w-full rounded-2xl bg-[#101824] px-4 pr-10 text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition placeholder:text-zinc-500 focus:bg-[#131d2b]"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-500">
                    %
                  </span>
                </div>
              </FormField>

              <FormField label="Nama Agent">
                <AgentSelect
                  options={agents}
                  value={agentId}
                  onChange={setAgentId}
                />
              </FormField>
            </div>
          </div>

          <div className="flex flex-col gap-2 px-5 pb-5 sm:flex-row sm:justify-end sm:px-6">
            <ActionButton
              onClick={onClose}
              icon="solar:close-circle-linear"
              tone="secondary"
              className="sm:w-auto"
            >
              Batal
            </ActionButton>

            <ActionButton
              onClick={onSubmit}
              icon="solar:add-circle-linear"
              tone="primary"
              className="sm:w-auto sm:min-w-[180px]"
            >
              Tambahkan Pos
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-zinc-200">{label}</div>
      {children}
    </div>
  );
}
