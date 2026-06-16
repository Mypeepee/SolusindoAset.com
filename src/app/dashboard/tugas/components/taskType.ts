// app/dashboard/tugas/components/taskType.ts
import type { DailyTask } from "./types";

export type TaskType =
  | "HUBUNGI_WA"
  | "TITIP_JUAL"
  | "POST_LISTING"
  | "FOLLOWUP"
  | "AJUKAN_PENAWARAN"
  | "COBROKE";

export interface TaskTypeConfig {
  label: string;
  icon: string;
  /** short verb describing the click action, e.g. "Buka percakapan" */
  cta: string;
  tagline: string;
  /** the playbook — what a pro agent does for this task */
  steps: string[];
  /** tailwind text color for the type chip */
  tint: string;
}

export const TASK_TYPE_CFG: Record<TaskType, TaskTypeConfig> = {
  HUBUNGI_WA: {
    label: "Hubungi via WhatsApp",
    icon: "solar:chat-round-call-bold-duotone",
    cta: "Buka percakapan",
    tagline: "Konversi kontak ini jadi lead sebelum dingin.",
    steps: [
      "Kirim pesan pembuka yang personal via WhatsApp",
      "Gali kebutuhan & catat tingkat minat",
      "Tandai jadi lead bila ada ketertarikan",
    ],
    tint: "text-emerald-300",
  },
  TITIP_JUAL: {
    label: "Titip Jual",
    icon: "solar:hand-money-bold-duotone",
    cta: "Proses titipan",
    tagline: "Amankan properti titipan & naikkan jadi listing.",
    steps: [
      "Hubungi pemilik & konfirmasi detail properti",
      "Sepakati harga, komisi, dan dokumen",
      "Upload jadi listing resmi",
    ],
    tint: "text-amber-300",
  },
  POST_LISTING: {
    label: "Post Listing",
    icon: "solar:gallery-add-bold-duotone",
    cta: "Publikasikan",
    tagline: "Sebarkan listing untuk exposure maksimal hari ini.",
    steps: [
      "Susun caption & pilih foto terbaik",
      "Pilih channel (IG, marketplace, grup)",
      "Publikasikan lalu tandai sudah posting",
    ],
    tint: "text-violet-300",
  },
  FOLLOWUP: {
    label: "Follow-up Lead",
    icon: "solar:phone-calling-bold-duotone",
    cta: "Lanjut follow-up",
    tagline: "Jaga momentum — follow-up tepat waktu naikkan closing.",
    steps: [
      "Cek histori percakapan & tahap pipeline",
      "Kirim follow-up sesuai konteks terakhir",
      "Jadwalkan langkah berikutnya",
    ],
    tint: "text-sky-300",
  },
  AJUKAN_PENAWARAN: {
    label: "Ajukan Penawaran",
    icon: "solar:document-add-bold-duotone",
    cta: "Susun penawaran",
    tagline: "Kirim penawaran resmi ke pemilik/PIC.",
    steps: [
      "Tentukan harga & syarat penawaran",
      "Kirim penawaran ke pihak terkait",
      "Pantau status: pending / diterima / ditolak",
    ],
    tint: "text-teal-300",
  },
  COBROKE: {
    label: "Cobroke dengan Agent",
    icon: "solar:users-group-two-rounded-bold-duotone",
    cta: "Koordinasi cobroke",
    tagline: "Sinkron dengan agent partner untuk closing bersama.",
    steps: [
      "Hubungi agent partner",
      "Sepakati split komisi & pembagian peran",
      "Koordinasi viewing / proses closing",
    ],
    tint: "text-pink-300",
  },
};

/**
 * Derive the task type from existing data (no DB change required yet).
 * Penawaran & Cobroke are not emitted by the auto API yet, but manual tasks
 * can carry those categories/titles.
 */
export function getTaskType(t: DailyTask): TaskType {
  if (t.source === "titip") return "TITIP_JUAL";
  if (t.source === "listing") return "POST_LISTING";
  if (t.source === "penawaran") return "AJUKAN_PENAWARAN";
  if (t.source === "cobroke") return "COBROKE";

  const title = t.title.toLowerCase();
  if (title.includes("penawaran")) return "AJUKAN_PENAWARAN";
  if (title.includes("cobroke") || title.includes("co-broke")) return "COBROKE";

  if (t.source === "lead") {
    // No prior pipeline stage → still a cold/new contact to reach out to.
    return t.pipelineStage ? "FOLLOWUP" : "HUBUNGI_WA";
  }

  // Manual / unknown → map by category
  if (t.category === "KONTEN") return "POST_LISTING";
  if (t.category === "FOLLOWUP") return "FOLLOWUP";
  return "FOLLOWUP";
}
