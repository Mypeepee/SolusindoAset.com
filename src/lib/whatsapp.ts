/** Nomor kosong membuka pemilih kontak untuk membagikan pesan. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "62");
  const text = encodeURIComponent(message);
  const recipient = digits ? `phone=${digits}&` : "";

  // Endpoint langsung menghindari redirect tambahan wa.me. Jangan paksa
  // web.whatsapp.com karena pengguna mungkin memakai aplikasi Desktop.
  return `https://api.whatsapp.com/send?${recipient}text=${text}`;
}
