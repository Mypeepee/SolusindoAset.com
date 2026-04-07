export type ParsedRisalah = {
    nomor_risalah: string;
    tanggal_risalah: string;
    uraian: string;
  };
  
  export function parseRisalah(text: string): ParsedRisalah {
    return {
      nomor_risalah: "",
      tanggal_risalah: "",
      uraian: "",
    };
  }