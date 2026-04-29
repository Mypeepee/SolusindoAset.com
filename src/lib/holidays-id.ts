export interface HolidayData {
  tanggal: string; // format: "YYYY-MM-DD"
  keterangan: string;
  is_cuti: boolean;
}

const HOLIDAYS: HolidayData[] = [
  // === 2025 ===
  { tanggal: "2025-01-01", keterangan: "Tahun Baru Masehi", is_cuti: false },
  { tanggal: "2025-01-27", keterangan: "Isra Mikraj Nabi Muhammad SAW", is_cuti: false },
  { tanggal: "2025-01-28", keterangan: "Cuti Bersama Tahun Baru Imlek", is_cuti: true },
  { tanggal: "2025-01-29", keterangan: "Tahun Baru Imlek 2576", is_cuti: false },
  { tanggal: "2025-03-28", keterangan: "Cuti Bersama Hari Suci Nyepi", is_cuti: true },
  { tanggal: "2025-03-29", keterangan: "Hari Suci Nyepi (Tahun Baru Saka 1947)", is_cuti: false },
  { tanggal: "2025-03-31", keterangan: "Hari Raya Idul Fitri 1446 H", is_cuti: false },
  { tanggal: "2025-04-01", keterangan: "Hari Raya Idul Fitri 1446 H (Hari ke-2)", is_cuti: false },
  { tanggal: "2025-04-02", keterangan: "Cuti Bersama Idul Fitri", is_cuti: true },
  { tanggal: "2025-04-03", keterangan: "Cuti Bersama Idul Fitri", is_cuti: true },
  { tanggal: "2025-04-04", keterangan: "Cuti Bersama Idul Fitri", is_cuti: true },
  { tanggal: "2025-04-07", keterangan: "Cuti Bersama Idul Fitri", is_cuti: true },
  { tanggal: "2025-04-18", keterangan: "Wafat Isa Al Masih", is_cuti: false },
  { tanggal: "2025-05-01", keterangan: "Hari Buruh Internasional", is_cuti: false },
  { tanggal: "2025-05-12", keterangan: "Hari Raya Waisak 2569 BE", is_cuti: false },
  { tanggal: "2025-05-13", keterangan: "Cuti Bersama Waisak", is_cuti: true },
  { tanggal: "2025-05-29", keterangan: "Kenaikan Isa Al Masih", is_cuti: false },
  { tanggal: "2025-05-30", keterangan: "Cuti Bersama Kenaikan Isa Al Masih", is_cuti: true },
  { tanggal: "2025-06-01", keterangan: "Hari Lahir Pancasila", is_cuti: false },
  { tanggal: "2025-06-06", keterangan: "Hari Raya Idul Adha 1446 H", is_cuti: false },
  { tanggal: "2025-06-27", keterangan: "Tahun Baru Islam 1447 H", is_cuti: false },
  { tanggal: "2025-08-17", keterangan: "Hari Kemerdekaan Republik Indonesia", is_cuti: false },
  { tanggal: "2025-09-05", keterangan: "Maulid Nabi Muhammad SAW", is_cuti: false },
  { tanggal: "2025-12-25", keterangan: "Hari Raya Natal", is_cuti: false },
  { tanggal: "2025-12-26", keterangan: "Cuti Bersama Natal", is_cuti: true },

  // === 2026 ===
  { tanggal: "2026-01-01", keterangan: "Tahun Baru Masehi", is_cuti: false },
  { tanggal: "2026-01-26", keterangan: "Isra Mikraj Nabi Muhammad SAW", is_cuti: false },
  { tanggal: "2026-02-17", keterangan: "Tahun Baru Imlek 2577", is_cuti: false },
  { tanggal: "2026-03-09", keterangan: "Hari Suci Nyepi (Tahun Baru Saka 1948)", is_cuti: false },
  { tanggal: "2026-03-20", keterangan: "Hari Raya Idul Fitri 1447 H", is_cuti: false },
  { tanggal: "2026-03-21", keterangan: "Hari Raya Idul Fitri 1447 H (Hari ke-2)", is_cuti: false },
  { tanggal: "2026-03-23", keterangan: "Cuti Bersama Idul Fitri", is_cuti: true },
  { tanggal: "2026-03-24", keterangan: "Cuti Bersama Idul Fitri", is_cuti: true },
  { tanggal: "2026-03-25", keterangan: "Cuti Bersama Idul Fitri", is_cuti: true },
  { tanggal: "2026-03-26", keterangan: "Cuti Bersama Idul Fitri", is_cuti: true },
  { tanggal: "2026-04-03", keterangan: "Wafat Isa Al Masih", is_cuti: false },
  { tanggal: "2026-05-01", keterangan: "Hari Buruh Internasional", is_cuti: false },
  { tanggal: "2026-05-14", keterangan: "Kenaikan Isa Al Masih", is_cuti: false },
  { tanggal: "2026-05-24", keterangan: "Hari Raya Waisak 2570 BE", is_cuti: false },
  { tanggal: "2026-05-27", keterangan: "Hari Raya Idul Adha 1447 H", is_cuti: false },
  { tanggal: "2026-06-01", keterangan: "Hari Lahir Pancasila", is_cuti: false },
  { tanggal: "2026-06-16", keterangan: "Tahun Baru Islam 1448 H", is_cuti: false },
  { tanggal: "2026-08-17", keterangan: "Hari Kemerdekaan Republik Indonesia", is_cuti: false },
  { tanggal: "2026-08-25", keterangan: "Maulid Nabi Muhammad SAW", is_cuti: false },
  { tanggal: "2026-12-25", keterangan: "Hari Raya Natal", is_cuti: false },
  { tanggal: "2026-12-26", keterangan: "Cuti Bersama Natal", is_cuti: true },
];

export function getHolidaysForMonth(year: number, month: number): HolidayData[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return HOLIDAYS.filter((h) => h.tanggal.startsWith(prefix));
}

export function getHolidaysForYear(year: number): HolidayData[] {
  return HOLIDAYS.filter((h) => h.tanggal.startsWith(`${year}-`));
}
