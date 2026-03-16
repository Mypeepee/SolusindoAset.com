"use client";

import {
  useCallback,
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
  agent_id?: string | number | null;
  kode?: string | number | null;

  nama?: string | null;
  name?: string | null;
  agent_name?: string | null;
  full_name?: string | null;
  nama_agent?: string | null;
  nama_lengkap?: string | null;

  kantor?: string | null;
  office?: string | null;
  kantor_nama?: string | null;
  office_name?: string | null;
  nama_kantor?: string | null;

  jabatan?: string | null;

  agent?: {
    id_agent?: string | number | null;
    id?: string | number | null;
    agent_id?: string | number | null;
    nama?: string | null;
    name?: string | null;
    full_name?: string | null;
    nama_lengkap?: string | null;
    kantor?: string | null;
    office?: string | null;
    nama_kantor?: string | null;
    jabatan?: string | null;
  } | null;
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

type CalculatedRow = SplitRow & {
  nominal: number;
  effectivePercent: number;
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
  jabatan?: string;
};

type StoredLegacyRow = {
  id?: string;
  code?: string;
  label?: string;
  percent?: number | string;
  agentId?: string;
  agentName?: string;
};

type RelationAgent = {
  id_agent: string;
  nama: string;
  kantor: string | null;
  jabatan?: string | null;
};

type AgentRelationsResponse = {
  agents: RelationAgent[];
  selectedAgent: RelationAgent | null;
  upline: RelationAgent | null;
  teamLeader: RelationAgent | null;
  downlines: RelationAgent[];
  teamLeaderOptions: RelationAgent[];
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

type AuctionHistoryRow = {
  id_property?: string | number | null;
  agent_nama?: string | null;
};

type CopicDefinition = {
  code: string;
  label: string;
  percent: number;
  agentId: string;
  name: string;
  count: number;
  shareCount: number;
};

/* =========================================
  Helpers
========================================= */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
    (listing as any)?.id_property ??
      (listing as any)?.id_listing ??
      (listing as any)?.listing_id ??
      listing?.id_property ??
      ""
  )}`;
}

function storageKeyPembagian(listing: Listing) {
  return `closing:pembagian:${String(
    (listing as any)?.id_property ??
      (listing as any)?.id_listing ??
      (listing as any)?.listing_id ??
      listing?.id_property ??
      ""
  )}`;
}

function getAgentId(item: AgentOption | Agent | null | undefined) {
  const raw =
    (item as any)?.id_agent ??
    (item as any)?.agent_id ??
    (item as any)?.id ??
    (item as any)?.kode ??
    (item as any)?.agent?.id_agent ??
    (item as any)?.agent?.agent_id ??
    (item as any)?.agent?.id ??
    "";
  return String(raw ?? "").trim();
}

function getAgentName(item: AgentOption | Agent | null | undefined) {
  const raw =
    (item as any)?.nama ??
    (item as any)?.name ??
    (item as any)?.agent_name ??
    (item as any)?.full_name ??
    (item as any)?.nama_agent ??
    (item as any)?.nama_lengkap ??
    (item as any)?.agent?.nama ??
    (item as any)?.agent?.name ??
    (item as any)?.agent?.full_name ??
    (item as any)?.agent?.nama_lengkap ??
    "";
  return String(raw ?? "").trim();
}

function getAgentOffice(item: AgentOption | Agent | null | undefined) {
  const raw =
    (item as any)?.kantor ??
    (item as any)?.office ??
    (item as any)?.kantor_nama ??
    (item as any)?.office_name ??
    (item as any)?.nama_kantor ??
    (item as any)?.agent?.kantor ??
    (item as any)?.agent?.office ??
    (item as any)?.agent?.nama_kantor ??
    "";
  return String(raw ?? "").trim();
}

function getAgentJabatan(item: AgentOption | Agent | null | undefined) {
  const raw = (item as any)?.jabatan ?? (item as any)?.agent?.jabatan ?? "";
  return String(raw ?? "").trim();
}

function buildAgentLabel(name: string, office: string, id?: string) {
  const idText = id ? ` | #${id}` : "";
  return `${name || "-"} | ${office || "-"}${idText}`;
}

function findAgentIdByName(agents: AgentCatalogItem[], name: string): string {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return "";
  const found = agents.find((a) => a.name.trim().toLowerCase() === key);
  return found?.id ?? "";
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
    .toFixed(4)
    .replace(/\.0000$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1")
    .replace(/\.0$/, "");
}

function getNextCustomCode(rows: SplitRow[]) {
  const nextIndex =
    rows.filter((row) =>
      row.code.trim().toUpperCase().startsWith("CUSTOM_")
    ).length + 1;

  return `CUSTOM_${nextIndex}`;
}

function normalizeFetchedAgents(raw: any): AgentOption[] {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.agents)
    ? raw.agents
    : Array.isArray(raw?.results)
    ? raw.results
    : Array.isArray(raw?.rows)
    ? raw.rows
    : Array.isArray(raw?.list)
    ? raw.list
    : Array.isArray(raw?.payload)
    ? raw.payload
    : Array.isArray(raw?.detail)
    ? raw.detail
    : Array.isArray(raw?.items)
    ? raw.items
    : [];

  return source
    .map((item: any) => ({
      id_agent:
        item?.id_agent ??
        item?.agent_id ??
        item?.id ??
        item?.idAgent ??
        item?.kode ??
        item?.agent?.id_agent ??
        item?.agent?.agent_id ??
        item?.agent?.id ??
        null,
      nama:
        item?.nama ??
        item?.name ??
        item?.agent_name ??
        item?.full_name ??
        item?.nama_agent ??
        item?.nama_lengkap ??
        item?.agent?.nama ??
        item?.agent?.name ??
        item?.agent?.full_name ??
        item?.agent?.nama_lengkap ??
        null,
      kantor:
        item?.kantor ??
        item?.office ??
        item?.kantor_nama ??
        item?.office_name ??
        item?.nama_kantor ??
        item?.agent?.kantor ??
        item?.agent?.office ??
        item?.agent?.nama_kantor ??
        null,
      jabatan: item?.jabatan ?? item?.agent?.jabatan ?? null,
    }))
    .filter((item) => {
      const id = String(item.id_agent ?? "").trim();
      const name = String(item.nama ?? "").trim();
      return Boolean(id || name);
    });
}

function normalizeRelationAgent(item: any): RelationAgent | null {
  if (!item) return null;

  const id_agent = String(
    item?.id_agent ?? item?.agent_id ?? item?.id ?? ""
  ).trim();
  const nama = String(
    item?.nama ??
      item?.name ??
      item?.full_name ??
      item?.nama_lengkap ??
      item?.agent_name ??
      ""
  ).trim();
  const kantor = String(
    item?.kantor ??
      item?.office ??
      item?.nama_kantor ??
      item?.kantor_nama ??
      ""
  ).trim();
  const jabatan = String(item?.jabatan ?? "").trim();

  if (!id_agent || !nama) return null;

  return {
    id_agent,
    nama,
    kantor: kantor || null,
    jabatan: jabatan || null,
  };
}

function normalizeRelationsResponse(raw: any): AgentRelationsResponse {
  const normalizeList = (list: any): RelationAgent[] =>
    Array.isArray(list)
      ? (list.map(normalizeRelationAgent).filter(Boolean) as RelationAgent[])
      : [];

  return {
    agents: normalizeList(raw?.agents),
    selectedAgent: normalizeRelationAgent(raw?.selectedAgent),
    upline: normalizeRelationAgent(raw?.upline),
    teamLeader: normalizeRelationAgent(raw?.teamLeader),
    downlines: normalizeList(raw?.downlines),
    teamLeaderOptions: normalizeList(raw?.teamLeaderOptions),
  };
}

function getInitials(name?: string | null) {
  if (!name) return "--";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function roundPercentFromNominal(nominal: number, base: number) {
  if (base <= 0) return 0;
  return Number(((nominal / base) * 100).toFixed(4));
}

function findRowIndexByCode(rows: SplitRow[], code: string) {
  return rows.findIndex(
    (row) => row.code.trim().toUpperCase() === code.trim().toUpperCase()
  );
}

function getListingId(listing: Listing) {
  return String(
    (listing as any)?.id_property ??
      (listing as any)?.id_listing ??
      (listing as any)?.listing_id ??
      (listing as any)?.id ??
      ""
  ).trim();
}

function isCopicCode(code: string) {
  return code.trim().toUpperCase().startsWith("COPIC");
}

function isPercentLockedCode(code: string) {
  const upper = code.trim().toUpperCase();
  return isCopicCode(upper) || upper === "FEE_TL";
}

function isDeleteLockedCode(code: string) {
  return isCopicCode(code);
}

function normalizeCopicName(raw: string) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
}

function copicSyntheticId(name: string) {
  return `COPIC::${normalizeCopicName(name).toLowerCase()}`;
}

function normalizeAuctionRows(raw: any): AuctionHistoryRow[] {
  const source = Array.isArray(raw?.rows)
    ? raw.rows
    : Array.isArray(raw)
    ? raw
    : [];
  return source.map((item: any) => ({
    id_property: item?.id_property ?? null,
    agent_nama: item?.agent_nama ?? item?.nama ?? item?.agent ?? null,
  }));
}

function buildCopicDefinitions(
  auctionRows: AuctionHistoryRow[],
  fallbackName: string
): CopicDefinition[] {
  const allNames = auctionRows
    .map((row) => normalizeCopicName(String(row?.agent_nama ?? "")))
    .filter((name) => name && name !== "-" && name !== "–");

  const effectiveNames = allNames.length
    ? allNames
    : normalizeCopicName(fallbackName)
    ? [normalizeCopicName(fallbackName)]
    : [];

  if (!effectiveNames.length) return [];

  const counts = new Map<string, { displayName: string; count: number }>();

  for (const name of effectiveNames) {
    const key = name.toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        displayName: name,
        count: 1,
      });
    }
  }

  const totalOccurrences = effectiveNames.length;
  const TOTAL_COPIC_PERCENT = 0.25;

  return Array.from(counts.values()).map((item, index) => ({
    code: `COPIC_${index + 1}`,
    label: totalOccurrences > 1 ? `CO PIC ${index + 1}` : "CO PIC",
    percent: Number(
      ((item.count / totalOccurrences) * TOTAL_COPIC_PERCENT).toFixed(6)
    ),
    agentId: copicSyntheticId(item.displayName),
    name: item.displayName,
    count: item.count,
    shareCount: totalOccurrences,
  }));
}

function buildRowsWithDynamicCopic(
  baseRows: SplitRow[],
  copicDefs: CopicDefinition[]
): SplitRow[] {
  const rowsWithoutCopic = baseRows.filter((row) => !isCopicCode(row.code));

  if (!copicDefs.length) {
    return [
      ...rowsWithoutCopic,
      {
        id: uid("copic"),
        code: "COPIC",
        label: "CO PIC",
        percent: 0.25,
        agentId: "",
      },
    ];
  }

  const copicRows: SplitRow[] = copicDefs.map((item) => ({
    id: uid(item.code.toLowerCase()),
    code: item.code,
    label: item.label,
    percent: item.percent,
    agentId: item.agentId,
  }));

  const templateIndex = baseRows.findIndex((row) => row.code === "COPIC");
  if (templateIndex < 0) {
    return [...rowsWithoutCopic, ...copicRows];
  }

  const before = baseRows.slice(0, templateIndex).filter((row) => !isCopicCode(row.code));
  const after = baseRows.slice(templateIndex + 1).filter((row) => !isCopicCode(row.code));
  return [...before, ...copicRows, ...after];
}

function normalizeStoredRows(
  rawRows: unknown,
  defaults: SplitRow[],
  agents: AgentCatalogItem[],
  copicDefs: CopicDefinition[]
): SplitRow[] {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return buildRowsWithDynamicCopic(defaults, copicDefs);
  }

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

  if (!rows.length) {
    return buildRowsWithDynamicCopic(defaults, copicDefs);
  }

  const merged = buildRowsWithDynamicCopic(rows, copicDefs);

  return merged.map((row) => {
    if (!isCopicCode(row.code)) return row;
    const def = copicDefs.find(
      (item) => item.code.trim().toUpperCase() === row.code.trim().toUpperCase()
    );
    if (!def) return row;
    return {
      ...row,
      label: def.label,
      percent: def.percent,
      agentId: def.agentId,
    };
  });
}

function applyLockedRowRules(
  rows: SplitRow[],
  closingAgentId: string,
  teamLeaderAgentId: string,
  copicDefs: CopicDefinition[]
): SplitRow[] {
  const copicMap = new Map(
    copicDefs.map((item) => [item.code.trim().toUpperCase(), item])
  );

  return rows.map((row) => {
    const upper = row.code.trim().toUpperCase();

    if (upper === "LISTER" || upper === "THC") {
      if (row.agentId === closingAgentId) return row;
      return { ...row, agentId: closingAgentId || "" };
    }

    if (upper === "FEE_TL") {
      if (row.agentId === teamLeaderAgentId) return row;
      return { ...row, agentId: teamLeaderAgentId || "" };
    }

    if (isCopicCode(upper)) {
      const def = copicMap.get(upper);
      if (!def) return row;
      return {
        ...row,
        label: def.label,
        percent: def.percent,
        agentId: def.agentId,
      };
    }

    return row;
  });
}

/* =========================================
  Core calculation
========================================= */
function calculateRows(rows: SplitRow[], selisihFinal: number): CalculatedRow[] {
  if (!rows.length) return [];

  const base = n(selisihFinal);
  if (base <= 0) {
    return rows.map((row) => ({
      ...row,
      nominal: 0,
      effectivePercent: 0,
    }));
  }

  const FEE_TL_MAX =
    typeof window !== "undefined" &&
    typeof (window as any).FEE_TL_MAX !== "undefined"
      ? n((window as any).FEE_TL_MAX)
      : 2_000_000;

  const FEE_TL_RATE =
    typeof window !== "undefined" &&
    typeof (window as any).FEE_TL_RATE !== "undefined"
      ? n((window as any).FEE_TL_RATE)
      : 0.1;

  const result: CalculatedRow[] = rows.map((row) => {
    const nominal = Math.round(base * (n(row.percent) / 100));
    return {
      ...row,
      nominal,
      effectivePercent: n(row.percent),
    };
  });

  const feeTlIndex = findRowIndexByCode(rows, "FEE_TL");
  const serviceIndex = findRowIndexByCode(rows, "SERVICE");
  const rewardIndex = findRowIndexByCode(rows, "REWARD");
  const promoIndex = findRowIndexByCode(rows, "PROMO_FUND");

  if (feeTlIndex >= 0) {
    const targetFeeTl = Math.round(Math.min(base * FEE_TL_RATE, FEE_TL_MAX));
    const availablePool =
      (serviceIndex >= 0 ? Math.max(0, result[serviceIndex].nominal) : 0) +
      (rewardIndex >= 0 ? Math.max(0, result[rewardIndex].nominal) : 0) +
      (promoIndex >= 0 ? Math.max(0, result[promoIndex].nominal) : 0);

    const actualFeeTl = Math.min(targetFeeTl, availablePool);
    let remaining = actualFeeTl;

    if (serviceIndex >= 0 && remaining > 0) {
      const cut = Math.min(result[serviceIndex].nominal, remaining);
      result[serviceIndex].nominal -= cut;
      remaining -= cut;
    }

    if (rewardIndex >= 0 && remaining > 0) {
      const cut = Math.min(result[rewardIndex].nominal, remaining);
      result[rewardIndex].nominal -= cut;
      remaining -= cut;
    }

    if (promoIndex >= 0 && remaining > 0) {
      const cut = Math.min(result[promoIndex].nominal, remaining);
      result[promoIndex].nominal -= cut;
      remaining -= cut;
    }

    result[feeTlIndex].nominal = actualFeeTl;
  }

  for (const row of result) {
    row.nominal = Math.max(0, Math.round(row.nominal));
    row.effectivePercent = roundPercentFromNominal(row.nominal, base);
  }

  const totalNominal = result.reduce((sum, row) => sum + n(row.nominal), 0);
  const diff = base - totalNominal;

  if (diff !== 0) {
    const thcIndex = result.findIndex(
      (row) => row.code.trim().toUpperCase() === "THC"
    );
    const preferredAdjustIndex = thcIndex >= 0 ? thcIndex : result.length - 1;

    if (preferredAdjustIndex >= 0) {
      result[preferredAdjustIndex].nominal = Math.max(
        0,
        result[preferredAdjustIndex].nominal + diff
      );
      result[preferredAdjustIndex].effectivePercent = roundPercentFromNominal(
        result[preferredAdjustIndex].nominal,
        base
      );
    }
  }

  return result;
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
  {
    code: "LISTER",
    label: "Lister",
    percent: 1,
    defaultAgent: "CLOSING_AGENT",
  },
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
  {
    code: "THC",
    label: "THC",
    percent: 40,
    defaultAgent: "CLOSING_AGENT",
  },
  { code: "SERVICE", label: "Service Fund", percent: 10 },
  {
    code: "FEE_TL",
    label: "Fee Team Leader",
    percent: 0,
    defaultAgent: "TEAM_LEADER",
  },
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

const LOCKED_AGENT_CODES = new Set(["LISTER", "THC", "FEE_TL"]);

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
  void skemaPenjualan;

  const transaksiKey = useMemo(() => storageKeyTransaksi(listing), [listing]);
  const pembagianKey = useMemo(() => storageKeyPembagian(listing), [listing]);
  const listingId = useMemo(() => getListingId(listing), [listing]);
  const closingAgentRefId = useMemo(() => getAgentId(agent), [agent]);

  const [loadedTransaksi, setLoadedTransaksi] = useState(false);
  const [loadedPembagian, setLoadedPembagian] = useState(false);
  const [persisted, setPersisted] = useState<PersistedState | null>(null);
  const [rows, setRows] = useState<SplitRow[]>([]);

  const [remoteAgents, setRemoteAgents] = useState<AgentOption[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);

  const [relations, setRelations] = useState<AgentRelationsResponse>({
    agents: [],
    selectedAgent: null,
    upline: null,
    teamLeader: null,
    downlines: [],
    teamLeaderOptions: [],
  });
  const [isLoadingRelations, setIsLoadingRelations] = useState(false);

  const [auctionRows, setAuctionRows] = useState<AuctionHistoryRow[]>([]);
  const [isLoadingAuctionHistory, setIsLoadingAuctionHistory] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPercentInput, setNewPercentInput] = useState("0");
  const [newAgentId, setNewAgentId] = useState("");
  const [persistedAgentSelection, setPersistedAgentSelection] = useState<{
    selectedAgentId: string;
    selectedLeaderId: string;
  }>({
    selectedAgentId: "",
    selectedLeaderId: "",
  });

  const hydratedPembagianKeyRef = useRef<string>("");
  const agentSelectionStorageKey = useMemo(
    () => (closingAgentRefId ? `tab-agent-selection:${closingAgentRefId}` : ""),
    [closingAgentRefId]
  );

  useEffect(() => {
    if (!listingId) {
      setRemoteAgents([]);
      return;
    }

    const controller = new AbortController();

    async function loadAgents() {
      try {
        setIsLoadingAgents(true);

        const res = await fetch(
          `/api/closing/listing/${encodeURIComponent(listingId)}/detail_pembagian`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        setRemoteAgents(normalizeFetchedAgents(json));
      } catch (error: any) {
        if (error?.name !== "AbortError") setRemoteAgents([]);
      } finally {
        if (!controller.signal.aborted) setIsLoadingAgents(false);
      }
    }

    loadAgents();
    return () => controller.abort();
  }, [listingId]);

  useEffect(() => {
    if (String((listing as any)?.jenis_transaksi ?? "").toUpperCase() !== "LELANG") {
      setAuctionRows([]);
      return;
    }

    if (!listingId) {
      setAuctionRows([]);
      return;
    }

    const controller = new AbortController();

    async function loadAuctionHistory() {
      try {
        setIsLoadingAuctionHistory(true);

        const res = await fetch(
          `/api/closing/listing/${encodeURIComponent(listingId)}/auction-history`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        setAuctionRows(normalizeAuctionRows(json));
      } catch (error: any) {
        if (error?.name !== "AbortError") setAuctionRows([]);
      } finally {
        if (!controller.signal.aborted) setIsLoadingAuctionHistory(false);
      }
    }

    loadAuctionHistory();
    return () => controller.abort();
  }, [listing, listingId]);

  useEffect(() => {
    if (!agentSelectionStorageKey) {
      setPersistedAgentSelection({
        selectedAgentId: "",
        selectedLeaderId: "",
      });
      return;
    }

    function hydrateSelection() {
      try {
        const raw = localStorage.getItem(agentSelectionStorageKey);
        if (!raw) {
          setPersistedAgentSelection({
            selectedAgentId: "",
            selectedLeaderId: "",
          });
          return;
        }

        const parsed = JSON.parse(raw) as Partial<{
          selectedAgentId: string;
          selectedLeaderId: string;
        }>;

        setPersistedAgentSelection({
          selectedAgentId: String(parsed?.selectedAgentId ?? "").trim(),
          selectedLeaderId: String(parsed?.selectedLeaderId ?? "").trim(),
        });
      } catch {
        setPersistedAgentSelection({
          selectedAgentId: "",
          selectedLeaderId: "",
        });
      }
    }

    hydrateSelection();

    function onStorage(ev: StorageEvent) {
      if (ev.key !== agentSelectionStorageKey) return;
      hydrateSelection();
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [agentSelectionStorageKey]);

  useEffect(() => {
    if (!closingAgentRefId) {
      setRelations({
        agents: [],
        selectedAgent: null,
        upline: null,
        teamLeader: null,
        downlines: [],
        teamLeaderOptions: [],
      });
      return;
    }

    const controller = new AbortController();

    async function loadRelations() {
      try {
        setIsLoadingRelations(true);

        const res = await fetch(
          `/api/closing/listing/${encodeURIComponent(closingAgentRefId)}/agent`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        setRelations(normalizeRelationsResponse(json));
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setRelations({
            agents: [],
            selectedAgent: null,
            upline: null,
            teamLeader: null,
            downlines: [],
            teamLeaderOptions: [],
          });
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingRelations(false);
      }
    }

    loadRelations();
    return () => controller.abort();
  }, [closingAgentRefId]);

  const relationAgentsAsOptions = useMemo<AgentOption[]>(() => {
    const pack: RelationAgent[] = [
      ...relations.agents,
      ...relations.teamLeaderOptions,
      ...relations.downlines,
      ...(relations.selectedAgent ? [relations.selectedAgent] : []),
      ...(relations.upline ? [relations.upline] : []),
      ...(relations.teamLeader ? [relations.teamLeader] : []),
    ];

    return pack.map((item) => ({
      id_agent: item.id_agent,
      nama: item.nama,
      kantor: item.kantor,
      jabatan: item.jabatan ?? null,
    }));
  }, [relations]);

  const mergedAgents = useMemo(
    () => [...agents, ...remoteAgents, ...relationAgentsAsOptions],
    [agents, remoteAgents, relationAgentsAsOptions]
  );

  const baseAgentCatalog = useMemo<AgentCatalogItem[]>(() => {
    const map = new Map<string, AgentCatalogItem>();

    for (const item of mergedAgents) {
      const id = getAgentId(item);
      const name = getAgentName(item);
      if (!id || !name) continue;
      if (map.has(id)) continue;

      const office = getAgentOffice(item);
      const jabatan = getAgentJabatan(item);

      map.set(id, {
        id,
        name,
        office,
        jabatan,
        label: buildAgentLabel(name, office, id),
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "id-ID")
    );
  }, [mergedAgents]);

  const closingAgentId = useMemo(() => {
    return (
      persistedAgentSelection.selectedAgentId ||
      relations.selectedAgent?.id_agent ||
      getAgentId(agent) ||
      findAgentIdByName(baseAgentCatalog, getAgentName(agent))
    );
  }, [
    persistedAgentSelection.selectedAgentId,
    relations.selectedAgent,
    agent,
    baseAgentCatalog,
  ]);

  const teamLeaderAgentId = useMemo(() => {
    return (
      persistedAgentSelection.selectedLeaderId ||
      relations.teamLeader?.id_agent ||
      findAgentIdByName(baseAgentCatalog, teamLeaderName)
    );
  }, [
    persistedAgentSelection.selectedLeaderId,
    relations.teamLeader,
    baseAgentCatalog,
    teamLeaderName,
  ]);

  const copicDefinitions = useMemo(() => {
    const currentAgentName =
      normalizeCopicName(String((listing as any)?.agent_nama ?? "")) ||
      normalizeCopicName(getAgentName(agent));

    return buildCopicDefinitions(auctionRows, currentAgentName);
  }, [auctionRows, listing, agent]);

  const copicSyntheticAgents = useMemo<AgentCatalogItem[]>(() => {
    return copicDefinitions.map((item) => ({
      id: item.agentId,
      name: item.name,
      office: `CO PIC • ${item.count}/${item.shareCount} tayang`,
      jabatan: "CO PIC",
      label: buildAgentLabel(
        item.name,
        `CO PIC • ${item.count}/${item.shareCount} tayang`,
        item.agentId
      ),
    }));
  }, [copicDefinitions]);

  const agentCatalog = useMemo<AgentCatalogItem[]>(() => {
    const map = new Map<string, AgentCatalogItem>();

    for (const item of [...baseAgentCatalog, ...copicSyntheticAgents]) {
      if (!item.id || !item.name) continue;
      if (map.has(item.id)) continue;
      map.set(item.id, item);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "id-ID")
    );
  }, [baseAgentCatalog, copicSyntheticAgents]);

  const defaultRows = useMemo(() => {
    const baseDefaults = buildDefaultRows(closingAgentId, teamLeaderAgentId);
    const withCopic = buildRowsWithDynamicCopic(baseDefaults, copicDefinitions);
    return applyLockedRowRules(
      withCopic,
      closingAgentId,
      teamLeaderAgentId,
      copicDefinitions
    );
  }, [closingAgentId, teamLeaderAgentId, copicDefinitions]);

  useEffect(() => {
    setLoadedTransaksi(false);
    try {
      const raw = localStorage.getItem(transaksiKey);
      setPersisted(raw ? (JSON.parse(raw) as PersistedState) : null);
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
      const normalized = raw
        ? normalizeStoredRows(
            JSON.parse(raw),
            buildDefaultRows(closingAgentId, teamLeaderAgentId),
            agentCatalog,
            copicDefinitions
          )
        : defaultRows;

      setRows(
        applyLockedRowRules(
          normalized,
          closingAgentId,
          teamLeaderAgentId,
          copicDefinitions
        )
      );
    } catch {
      setRows(defaultRows);
    } finally {
      setLoadedPembagian(true);
    }
  }, [
    pembagianKey,
    defaultRows,
    agentCatalog,
    copicDefinitions,
    closingAgentId,
    teamLeaderAgentId,
  ]);

  useEffect(() => {
    function onUpdated(ev: Event) {
      const e = ev as CustomEvent<{ key: string; payload: PersistedState }>;
      if (e.detail?.key !== transaksiKey) return;
      setPersisted(e.detail.payload);
    }

    function onStorage(ev: StorageEvent) {
      if (ev.key !== transaksiKey) return;
      try {
        setPersisted(
          ev.newValue ? (JSON.parse(ev.newValue) as PersistedState) : null
        );
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

  useEffect(() => {
    if (!loadedPembagian) return;

    setRows((prev) => {
      const withLocks = applyLockedRowRules(
        buildRowsWithDynamicCopic(prev, copicDefinitions),
        closingAgentId,
        teamLeaderAgentId,
        copicDefinitions
      );

      const same =
        withLocks.length === prev.length &&
        withLocks.every((row, index) => {
          const old = prev[index];
          return (
            old &&
            old.id === row.id &&
            old.code === row.code &&
            old.label === row.label &&
            Number(old.percent) === Number(row.percent) &&
            old.agentId === row.agentId
          );
        });

      return same ? prev : withLocks;
    });
  }, [
    loadedPembagian,
    copicDefinitions,
    closingAgentId,
    teamLeaderAgentId,
  ]);

  const getLockedAgentIdByCode = useCallback(
    (code: string) => {
      const upper = code.trim().toUpperCase();
      if (upper === "LISTER" || upper === "THC") {
        return closingAgentId || "";
      }
      if (upper === "FEE_TL") {
        return teamLeaderAgentId || "";
      }
      if (isCopicCode(upper)) {
        const def = copicDefinitions.find(
          (item) => item.code.trim().toUpperCase() === upper
        );
        return def?.agentId ?? "";
      }
      return "";
    },
    [closingAgentId, teamLeaderAgentId, copicDefinitions]
  );

  const isLockedAgentCode = useCallback((code: string) => {
    const upper = code.trim().toUpperCase();
    return LOCKED_AGENT_CODES.has(upper) || isCopicCode(upper);
  }, []);

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

  const rowsCalculated = useMemo(
    () => calculateRows(rows, selisihFinal),
    [rows, selisihFinal]
  );

  const totalPercent = useMemo(() => {
    return Number(
      rowsCalculated.reduce((sum, row) => sum + n(row.effectivePercent), 0).toFixed(4)
    );
  }, [rowsCalculated]);

  const inputPercentTotal = useMemo(() => {
    return Number(rows.reduce((sum, row) => sum + n(row.percent), 0).toFixed(6));
  }, [rows]);

  const totalNominal = useMemo(
    () => rowsCalculated.reduce((sum, row) => sum + n(row.nominal), 0),
    [rowsCalculated]
  );

  const isEffectivePercentValid = Math.abs(totalPercent - 100) < 0.05;
  const isInputPercentValid = Math.abs(inputPercentTotal - 100) < 0.0001;

  const isTotalValid =
    Math.abs(totalNominal - selisihFinal) <= 1 &&
    isEffectivePercentValid &&
    isInputPercentValid;

  const agentMap = useMemo(() => {
    const map = new Map<string, AgentCatalogItem>();
    for (const item of agentCatalog) map.set(item.id, item);
    return map;
  }, [agentCatalog]);

  const getAgentById = useCallback(
    (agentId: string) => agentMap.get(agentId),
    [agentMap]
  );

  const updateRow = useCallback(
    (id: string, patch: Partial<SplitRow>) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== id) return row;
          if (isCopicCode(row.code)) return row;

          const next = { ...row, ...patch };

          if (isPercentLockedCode(row.code)) {
            next.percent = row.percent;
          }

          if (isLockedAgentCode(row.code)) {
            next.agentId = getLockedAgentIdByCode(row.code);
          }

          return next;
        })
      );
    },
    [getLockedAgentIdByCode, isLockedAgentCode]
  );

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id || isDeleteLockedCode(row.code)));
  }, []);

  const resetTemplate = useCallback(() => {
    setRows(defaultRows);
  }, [defaultRows]);

  const openAddModal = useCallback(() => {
    setNewLabel("");
    setNewPercentInput("0");
    setNewAgentId("");
    setIsAddModalOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
  }, []);

  const submitAddRow = useCallback(() => {
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
  }, [newLabel, newPercentInput, newAgentId, rows]);

  const handleSave = useCallback(() => {
    if (!isInputPercentValid) {
      alert("Total porsi harus tepat 100%.");
      return;
    }

    if (!isEffectivePercentValid || !isTotalValid) {
      alert("Total pembagian belum valid.");
      return;
    }

    const payload: SavePayload = {
      selisihFinal,
      rows: rowsCalculated.map((row) => {
        const agentInfo = getAgentById(row.agentId);
        return {
          code: row.code,
          label: row.label,
          percent: row.effectivePercent,
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
  }, [
    getAgentById,
    isEffectivePercentValid,
    isInputPercentValid,
    isTotalValid,
    onSave,
    rowsCalculated,
    selisihFinal,
  ]);

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-9">
          <LuxePanel
            title="Detail Pembagian"
            right={
              transaksiReady ? (
                <div className="min-w-0">
                  <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:flex xl:flex-nowrap xl:items-center xl:justify-end xl:gap-3">
                    <InfoPill
                      icon="solar:percent-circle-linear"
                      label={`${formatPercentDisplay(inputPercentTotal)}%`}
                      tone={
                        isInputPercentValid
                          ? "success"
                          : inputPercentTotal > 100
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
                  <div className="hidden grid-cols-[1.3fr_0.9fr_1.15fr_minmax(220px,1.1fr)_56px] gap-3 bg-[linear-gradient(180deg,#0d1623_0%,#0b131f_100%)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 md:grid">
                    <div>Pos</div>
                    <div>Porsi</div>
                    <div>Nominal</div>
                    <div>Nama Agent</div>
                    <div />
                  </div>

                  <div className="divide-y divide-zinc-900/90">
                    {rowsCalculated.map((row) => {
                      const agentLocked = isLockedAgentCode(row.code);
                      const percentLocked = isPercentLockedCode(row.code);
                      const deleteLocked = isDeleteLockedCode(row.code);
                      const copicMeta = copicDefinitions.find(
                        (item) =>
                          item.code.trim().toUpperCase() ===
                          row.code.trim().toUpperCase()
                      );

                      return (
                        <div
                          key={row.id}
                          className="px-4 py-4 md:grid md:grid-cols-[1.3fr_0.9fr_1.15fr_minmax(220px,1.1fr)_56px] md:gap-3 md:px-5"
                          style={{
                            background:
                              "linear-gradient(180deg, rgba(11,16,26,0.88), rgba(8,12,19,0.94))",
                          }}
                        >
                          <div className="space-y-4 md:hidden">
                            <MobileField label="Pos">
                              <div className="flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                  <RowIdentity
                                    label={row.label}
                                    note={
                                      copicMeta
                                        ? `${copicMeta.count}/${copicMeta.shareCount} tayang`
                                        : undefined
                                    }
                                  />
                                </div>
                                {!deleteLocked ? (
                                  <DangerIconButton
                                    onClick={() => removeRow(row.id)}
                                    title="Hapus pos"
                                    small
                                  />
                                ) : (
                                  <LockBadge />
                                )}
                              </div>
                            </MobileField>

                            <MobileField label="Porsi (%)">
                              <PercentField
                                value={row.percent}
                                onChange={(value) =>
                                  updateRow(row.id, { percent: value })
                                }
                                disabled={percentLocked}
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
                                disabled={agentLocked}
                              />
                            </MobileField>
                          </div>

                          <div className="hidden min-w-0 md:flex md:items-center">
                            <RowIdentity
                              label={row.label}
                              note={
                                copicMeta
                                  ? `${copicMeta.count}/${copicMeta.shareCount} tayang`
                                  : undefined
                              }
                            />
                          </div>

                          <div className="hidden md:block">
                            <PercentField
                              value={row.percent}
                              onChange={(value) =>
                                updateRow(row.id, { percent: value })
                              }
                              disabled={percentLocked}
                            />
                          </div>

                          <div className="hidden md:block">
                            <ValueField>
                              <Money value={row.nominal} />
                            </ValueField>
                          </div>

                          <div className="hidden min-w-0 md:block">
                            <AgentSelect
                              options={agentCatalog}
                              value={row.agentId}
                              onChange={(value) =>
                                updateRow(row.id, { agentId: value })
                              }
                              disabled={agentLocked}
                            />
                          </div>

                          <div className="hidden items-center justify-end md:flex">
                            {!deleteLocked ? (
                              <DangerIconButton
                                onClick={() => removeRow(row.id)}
                                title="Hapus pos"
                              />
                            ) : (
                              <LockBadge desktop />
                            )}
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

                <div className="mt-3 text-xs text-zinc-500">
                  {isLoadingAgents || isLoadingRelations || isLoadingAuctionHistory
                    ? "Memuat daftar agent, relasi, dan histori CO PIC..."
                    : `Total agent tersedia: ${agentCatalog.length} • Total CO PIC unik: ${
                        copicDefinitions.length || 0
                      }`}
                </div>
              </>
            )}
          </LuxePanel>
        </div>

        <div className="xl:col-span-3">
          <div className="space-y-4 xl:sticky xl:top-4">
            <SnapshotPanel
              title="Snapshot"
              subtitle="Ringkasan transaksi"
              className="xl:px-3.5 xl:py-3.5"
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
                label="Sblm Royalty"
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
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.10),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_20%),linear-gradient(180deg,#0c111c_0%,#080b12_100%)] px-4 py-4 shadow-[0_20px_64px_rgba(0,0,0,0.42)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/14 to-transparent" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-white">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-xs text-zinc-400">{subtitle}</div>
            ) : null}
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white/[0.04] text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <Icon icon="solar:document-text-linear" className="text-lg" />
          </div>
        </div>
        <div className="mt-4 space-y-2.5">{children}</div>
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
        "flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        toneClass,
      ].join(" ")}
    >
      <div className={strong ? "text-xs font-semibold text-zinc-200" : "text-xs text-zinc-400"}>
        {label}
      </div>
      <div className={strong ? "text-xs font-semibold text-white" : "text-xs text-zinc-200"}>
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

function EmptyState({ title, desc }: { title: string; desc: string }) {
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
  note,
}: {
  label: string;
  note?: string;
}) {
  return (
    <div className="max-w-full">
      <div className="inline-flex max-w-full flex-col rounded-2xl bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <span className="truncate">{label}</span>
        {note ? (
          <span className="mt-1 text-[11px] font-medium text-zinc-400">{note}</span>
        ) : null}
      </div>
    </div>
  );
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
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
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
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
        disabled={disabled}
        onChange={(e) => {
          if (disabled) return;
          setDraft(sanitizeDecimalInput(e.target.value));
        }}
        onBlur={() => {
          if (disabled) {
            setDraft(formatPercentDisplay(value));
            return;
          }
          const parsed = parseDecimalInput(draft);
          onChange(parsed);
          setDraft(formatPercentDisplay(parsed));
        }}
        className={cn(
          "h-12 w-full rounded-2xl px-4 pr-10 text-base font-semibold outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition md:text-sm",
          disabled
            ? "cursor-not-allowed bg-[linear-gradient(90deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] text-cyan-100"
            : "bg-[#101824] text-white placeholder:text-zinc-500 focus:bg-[#131d2b]"
        )}
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
  disabled = false,
  portal = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AgentCatalogItem[];
  disabled?: boolean;
  portal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => options.find((item) => item.id === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setKeyword("");
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setKeyword("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => {
      const haystack = `${item.name} ${item.office} ${item.jabatan ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [keyword, options]);

  const triggerClass = disabled
    ? "cursor-not-allowed bg-[linear-gradient(90deg,rgba(16,185,129,0.12),rgba(255,255,255,0.02))] text-emerald-100"
    : "bg-[#101824] text-white hover:bg-[#131d2b]";

  return (
    <div ref={wrapperRef} className={cn("relative min-w-0", open && "z-[200]")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={cn(
          "flex h-14 w-full min-w-0 items-center justify-between gap-2 rounded-[24px] px-3 text-left transition shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
          triggerClass
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-semibold",
              disabled
                ? "bg-emerald-400/12 text-emerald-200"
                : selected
                ? "bg-cyan-500/12 text-cyan-200"
                : "bg-white/[0.05] text-zinc-300"
            )}
          >
            {selected ? getInitials(selected.name) : "--"}
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            {selected ? (
              <>
                <div className="truncate text-[15px] font-semibold leading-none text-white">
                  {selected.name}
                </div>
                {selected.office ? (
                  <div className="mt-1 truncate text-[11px] leading-none text-zinc-400">
                    {selected.office}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="truncate text-[15px] leading-none text-zinc-400">Pilih agent</div>
            )}
          </div>
        </div>

        <div className="ml-1 shrink-0 pl-1 text-zinc-400">
          <Icon
            icon={
              disabled
                ? "solar:lock-password-linear"
                : open
                ? "solar:alt-arrow-up-linear"
                : "solar:alt-arrow-down-linear"
            }
            className="text-lg"
          />
        </div>
      </button>

      {open && !disabled ? (
        <div
          className={cn(
            "absolute left-0 top-full z-[300] mt-3 w-full overflow-hidden rounded-[24px] bg-[#0d121c] shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.03)]",
            portal && "z-[500]"
          )}
        >
          <div className="border-b border-white/5 p-3">
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              <Icon icon="solar:magnifer-linear" className="text-base text-zinc-400" />
              <input
                ref={inputRef}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Cari nama agent..."
                className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {filteredOptions.length > 0 ? (
              <div className="space-y-1">
                {filteredOptions.map((item) => {
                  const selectedItem = value === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onChange(item.id);
                        setOpen(false);
                        setKeyword("");
                      }}
                      className={cn(
                        "flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition",
                        selectedItem
                          ? "bg-cyan-500/10 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.12)]"
                          : "hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-500/12 text-[11px] font-semibold text-cyan-200">
                          {getInitials(item.name)}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="truncate text-sm font-medium text-white">
                            {item.name}
                          </div>
                          {item.office ? (
                            <div className="truncate text-xs text-zinc-500">
                              {item.office}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {selectedItem ? (
                        <Icon
                          icon="solar:check-circle-linear"
                          className="shrink-0 text-lg text-cyan-300"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-8 text-center">
                <div className="text-sm font-medium text-white/70">Tidak ada hasil</div>
                <div className="mt-1 text-xs text-white/40">Coba gunakan nama agent lain.</div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DangerIconButton({
  onClick,
  title,
  small = false,
}: {
  onClick?: () => void;
  title?: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-100 transition hover:bg-red-500/15",
        small ? "h-11 w-11" : "h-12 w-12",
      ].join(" ")}
    >
      <Icon icon="solar:trash-bin-minimalistic-linear" className="text-xl" />
    </button>
  );
}

function LockBadge({ desktop = false }: { desktop?: boolean }) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-200",
        desktop ? "h-12 w-12" : "h-11 w-11"
      )}
      title="Pos ini terkunci"
    >
      <Icon icon="solar:lock-password-linear" className="text-xl" />
    </div>
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
      <div className="relative z-[120] w-full max-w-2xl overflow-visible rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_20%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.10),transparent_20%),linear-gradient(180deg,#0e1521_0%,#090d15_100%)] shadow-[0_35px_120px_rgba(0,0,0,0.58)]">
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

          <div className="grid gap-5 overflow-visible px-5 pb-5 sm:px-6">
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
                  portal
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

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-visible">
      <div className="mb-2 text-sm font-semibold text-zinc-200">{label}</div>
      {children}
    </div>
  );
}