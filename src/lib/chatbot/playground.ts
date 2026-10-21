export type PlaygroundProperty = { id: string; name: string; location: string; price_display: string | null;
  price_label: string; land_area_m2: number | null; nearby_count: number; transaction_type: string };
export type PlaygroundAttachment = { id: string; filename: string; asset_id: string; mime_type: 'application/pdf'; bytes: number; url: string; caption?: string };
export type PlaygroundResponse = { reply: string | null; replies?: string[]; suppressed?: boolean; asset: PlaygroundProperty | null; knowledge: { status: string; source: string };
  attachments?: PlaygroundAttachment[]; document_error?: 'MOU_PDF_UNAVAILABLE';
  session?: { asset_id: string | null; is_bot_active: boolean; idle_timeout_ms: number };
  generation?: { mode: "primary" | "fallback" | "rules" } };

export function isPlaygroundResponse(value: unknown): value is PlaygroundResponse {
  if (!value || typeof value !== "object") return false;
  const data = value as PlaygroundResponse;
  return ((data.suppressed === true && data.reply === null) || (data.suppressed !== true && typeof data.reply === "string" && !!data.reply.trim() && data.reply.length <= 4096)) &&
    (data.replies === undefined || (data.suppressed !== true && Array.isArray(data.replies) && data.replies.length >= 2 && data.replies.length <= 6 &&
      data.replies[0] === data.reply && data.replies.every((reply) => typeof reply === "string" && !!reply.trim() && reply.length <= 4000))) &&
    !!data.knowledge && typeof data.knowledge.status === "string" && typeof data.knowledge.source === "string" &&
    (data.asset === null || (!!data.asset && typeof data.asset.id === "string" && /^[1-9]\d{0,17}$/.test(data.asset.id) &&
      typeof data.asset.name === "string" && typeof data.asset.location === "string" &&
      (data.asset.price_display === null || typeof data.asset.price_display === "string") && typeof data.asset.price_label === "string")) &&
    (!data.generation || ["primary", "fallback", "rules"].includes(data.generation.mode)) &&
    (data.attachments === undefined || Array.isArray(data.attachments) && data.attachments.length === 1 && data.attachments.every((file) =>
      !!file && typeof file === 'object' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(file.id) && file.asset_id === data.asset?.id &&
      file.filename === `Draf_MOU_Aset_${file.asset_id}.pdf` && file.mime_type === 'application/pdf' &&
      Number.isSafeInteger(file.bytes) && file.bytes >= 5 && file.bytes <= 4194304 && file.url === `/api/dashboard/chatbot/playground/documents/${file.id}` &&
      (file.caption === undefined || typeof file.caption === 'string' && file.caption.length <= 1000))) &&
    (data.document_error === undefined || data.document_error === 'MOU_PDF_UNAVAILABLE') &&
    (!data.session || ((data.session.asset_id === null || (typeof data.session.asset_id === "string" && /^[1-9]\d{0,17}$/.test(data.session.asset_id))) &&
      typeof data.session.is_bot_active === "boolean" && Number.isSafeInteger(data.session.idle_timeout_ms) && data.session.idle_timeout_ms >= 30 * 60000 && data.session.idle_timeout_ms <= 60 * 60000));
}

export function playgroundHistory(messages: { role: "user" | "assistant"; text: string }[]) {
  const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.text }));
  while (history.length > 1 && (history[0].role === "assistant" || history.reduce((n, m) => n + m.content.length, 0) > 24000)) history.shift();
  return history;
}

export function propertyTemplate(property: PlaygroundProperty) {
  return `Halo Jason Christopher Liendo 👋\n\nSaya tertarik dengan properti berikut, apakah masih tersedia?\n\n🔨 *${property.name}${property.land_area_m2 ? ` · LT ${property.land_area_m2} m²` : ""}*\n📍 ${property.location}\n💰 *${property.price_display || "Mohon informasi harga"}*\n🔖 Kode: *${property.id}*\n\nMohon infonya, terima kasih! 🙏`;
}
