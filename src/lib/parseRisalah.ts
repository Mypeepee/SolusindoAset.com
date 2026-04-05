export function parseRisalah(text: string) {

    const nomorRisalah =
      text.match(/Risalah\s*No\.?\s*([^\n]+)/i)?.[1]?.trim() || "";
  
    const tanggal =
      text.match(/Tanggal\s*([^\n]+)/i)?.[1]?.trim() || "";
  
    const bank =
      text.match(/Bank\s*([^\n]+)/i)?.[1]?.trim() || "";
  
    return {
      nomor_risalah: nomorRisalah,
      tanggal_risalah: tanggal,
      nama_bank: bank
    };
  }