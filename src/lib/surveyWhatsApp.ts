interface SurveyMessageInput {
  agentName: string;
  propertyTitle: string;
  propertyUrl: string;
  propertyDetails?: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  notes?: string;
}

export function buildSurveyMessage(input: SurveyMessageInput): string {
  return [
    `Halo ${input.agentName}, saya ingin menjadwalkan *Survei Lokasi* untuk properti:`,
    `*${input.propertyTitle}*`,
    ...(input.propertyDetails ? [`🛏️ ${input.propertyDetails}`] : []),
    "",
    "🔗 Detail properti di Solusindo Aset:",
    input.propertyUrl,
    "",
    `📅 Tanggal: ${input.date}`,
    `🕐 Waktu: ${input.time} WIB`,
    `👤 Nama: ${input.clientName.trim()}`,
    `📱 No. Telp: ${input.clientPhone}`,
    ...(input.notes?.trim() ? [`📝 Catatan: ${input.notes.trim()}`] : []),
    "",
    "Mohon konfirmasi jadwalnya. Terima kasih!",
  ].join("\n");
}

export { buildWhatsAppUrl as buildSurveyWhatsAppUrl } from "@/lib/whatsapp";
