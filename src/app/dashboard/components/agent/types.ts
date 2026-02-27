export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type LeadTemp = "HOT" | "WARM" | "COLD";
export type ListingStatus = "ACTIVE" | "DRAFT" | "SOLD";

export type AgentDashboardKpis = {
  newLeads7d: number;
  followupsDueToday: number;
  viewings7d: number;
  activeListings: number;
  negotiation: number;
  commissionYtd: number; // Rupiah
};

export type AgentDashboardPipeline = {
  contacted: number;
  qualified: number;
  viewing: number;
  negotiation: number;
  closed: number;
};

export type AgentTask = {
  id: string;
  title: string;
  dueAt: string; // ISO
  priority: Priority;
  leadName?: string;
  channel?: "WA" | "CALL" | "MEET";
};

export type AgentLead = {
  id: string;
  name: string;
  status: LeadTemp;
  source: string; // "Instagram", "WhatsApp", "Referral", ...
  lastContactAt?: string; // ISO
  phone?: string;
};

export type AgentListing = {
  id: string;
  title: string;
  area: string;
  price: number;
  inquiries7d: number;
  views7d: number;
  status: ListingStatus;
};

export type AgentDashboardData = {
  kpis: AgentDashboardKpis;
  pipeline: AgentDashboardPipeline;
  tasks: AgentTask[];
  leads: AgentLead[];
  listings: AgentListing[];
};