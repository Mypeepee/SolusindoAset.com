import re
from typing import Dict


BULAN_PATTERN = r"(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)"
DATE_PATTERN = rf"\d{{1,2}}\s+{BULAN_PATTERN}\s+\d{{4}}"

SERTIFIKAT_MAP = {
    "SHSRS": "Sertipikat Hak Satuan Rumah Susun",
    "SHGU": "Sertipikat Hak Guna Usaha",
    "SHGB": "Sertipikat Hak Guna Bangunan",
    "SHP": "Sertipikat Hak Pakai",
    "SHM": "Sertipikat Hak Milik",
}


def normalize_text(text: str) -> str:
    """Normalize text by cleaning up whitespace and line breaks."""
    text = text or ""
    text = text.replace("\r", "\n")
    text = text.replace("\t", " ")
    text = re.sub(r"[ ]{2,}", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def cleanup_inline(value: str) -> str:
    """Clean up inline text by removing extra whitespace and special chars."""
    return re.sub(r"\s+", " ", (value or "")).strip(" :;-\n\t")


def extract_nomor_kwitansi(text: str) -> str:
    """Extract kwitansi number (e.g., 1342/KNL.1001/2025-T3KW6M).

    Handles format where 'KUITANSI' heading is followed by 'Nomor: ...' on next line.
    """
    patterns = [
        # KUITANSI heading, then within 80 chars find Nomor: ...
        r"(?:KUITANSI|KWITANSI)[\s\S]{0,80}?Nomor\s*[:.]?\s*([A-Z0-9][A-Z0-9./-]+)",
        # Standalone "Nomor: ..." at start of line
        r"(?m)^Nomor\s*[:.]?\s*([A-Z0-9]\d*/[A-Z0-9.]+/[A-Z0-9.-]+)",
        # Known KPKNL format with KNL code
        r"(\d{3,4}/KNL\.[A-Z0-9.]+/[A-Z0-9-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result = cleanup_inline(match.group(1))
            if result and len(result) > 5:
                return result
    return ""


def extract_nomor_risalah_lelang(text: str) -> str:
    """Extract risalah lelang number (e.g., 1112/10.01/2025-01).

    Fixed: \d{1,3} changed to \d{1,4} to handle 4-digit prefix like 1112.
    """
    patterns = [
        # "Risalah Lelang Nomor : 1112/10.01/2025-01"
        r"Risalah\s+Lelang\s+Nomor\s*[:.]?\s*(\d{1,4}/\d{1,2}\.\d{2}/\d{4}-\d{2})",
        # Generic risalah number context
        r"(?:RISALAH\s+LELANG|NOMOR\s+RISALAH)[\s\S]{0,100}?(\d{1,4}/\d{1,2}\.\d{2}/\d{4}-\d{2})",
        # Fallback: any number in that format
        r"(\d{1,4}/\d{1,2}\.\d{2}/\d{4}-\d{2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return cleanup_inline(match.group(1))
    return ""


def extract_tanggal_risalah(text: str) -> str:
    """Extract risalah date (e.g., 18 Desember 2025).

    Looks for 'tanggal' keyword near 'risalah' / 'lelang' context.
    """
    patterns = [
        # "Risalah Lelang Nomor : ... tanggal 18 Desember 2025"
        rf"(?:risalah|lelang)[\s\S]{{0,200}}?tanggal\s+({DATE_PATTERN})",
        # Standalone "tanggal ..." line
        rf"tanggal\s+({DATE_PATTERN})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return cleanup_inline(match.group(1))
    # Fallback: first date in text
    match = re.search(DATE_PATTERN, text, re.IGNORECASE)
    return cleanup_inline(match.group(0)) if match else ""


def extract_luas(text: str) -> str:
    """Extract luas (area) value (e.g., 90 from 'total luas 90 m2')."""
    patterns = [
        # "total luas 90 m2" or "luas 90 m²"
        r"(?:total\s+)?luas\s+(\d+(?:[.,]\d+)?)\s*m",
        # "90 m2" or "90 m²"
        r"(\d{2,})\s*m[²2]",
        # Generic
        r"(?:LUAS|AREA)\s*[:.]?\s*(\d+(?:[.,]\d+)?)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return cleanup_inline(match.group(1))
    return ""


def extract_alamat(text: str) -> Dict[str, str]:
    """Extract address components: desa, kecamatan, kota, provinsi.

    Handles formats like 'Desa/Kel Tambakrejo', 'Kel. Tambakrejo', 'Kec. Simokerto'.
    Searches whole normalized text (not line-by-line) to handle multi-line splits.
    """
    result = {"desa": "", "kecamatan": "", "kota": "", "provinsi": ""}

    # Desa/Kelurahan — handles "Desa/Kel X", "Kel. X", "Kelurahan X", "Desa X"
    desa_match = re.search(
        r"(?:Desa/Kel|Desa|Kel\.?|Kelurahan)\s+([A-Za-z]+)",
        text,
        re.IGNORECASE,
    )
    if desa_match:
        result["desa"] = cleanup_inline(desa_match.group(1))

    # Kecamatan — handles "Kecamatan X", "Kec. X"
    kec_match = re.search(
        r"(?:Kecamatan|Kec\.?)\s+([A-Za-z]+)",
        text,
        re.IGNORECASE,
    )
    if kec_match:
        result["kecamatan"] = cleanup_inline(kec_match.group(1))

    # Kota/Kabupaten — prefer match that follows kecamatan to avoid "header" mentions
    kota_patterns = [
        r"(?:Kecamatan|Kec\.?)\s+[A-Za-z]+\s+(?:Kota|Kabupaten)\s+([A-Za-z]+)",
        r"(?:Kota|Kabupaten)\s+([A-Za-z]+)",
    ]
    for pat in kota_patterns:
        kota_match = re.search(pat, text, re.IGNORECASE)
        if kota_match:
            result["kota"] = cleanup_inline(kota_match.group(1))
            break

    # Provinsi — capture up to 2-word province name (e.g., "Jawa Timur")
    prov_match = re.search(
        r"Provinsi\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)",
        text,
        re.IGNORECASE,
    )
    if prov_match:
        result["provinsi"] = cleanup_inline(prov_match.group(1))

    return result


def extract_nama_bank(text: str) -> str:
    """Extract bank name (e.g., 'Pt. Bank Rakyat Indonesia (Persero), Tbk, Kantor Cabang Kapas Krampung').

    Captures text between 'atas permohonan' and 'dihadapan' in the keterangan section.
    """
    match = re.search(r"atas\s+permohonan\s+(.+?)\s+dihadapan", text, re.IGNORECASE | re.DOTALL)
    if match:
        return cleanup_inline(match.group(1))
    # Fallback: look for "permohonan ... Bank ..."
    match = re.search(r"permohonan\s+((?:Pt\.?\s+)?Bank\s+.+?)(?:\s+dihadapan|$)", text, re.IGNORECASE | re.DOTALL)
    if match:
        return cleanup_inline(match.group(1))
    return ""


def extract_singkatan_sertifikat(text: str) -> str:
    """Extract sertifikat abbreviation (SHM, SHGB, SHP, SHGU, SHSRS)."""
    # Longer codes checked first to avoid partial match (e.g. SHM inside SHGB)
    for abbr in SERTIFIKAT_MAP:
        if re.search(rf"\b{abbr}\b", text, re.IGNORECASE):
            return abbr
    return ""


def extract_no_sertifikat(text: str) -> str:
    """Extract full sertifikat reference (e.g., 00169/tambakrejo from 'SHM No 00169/tambakrejo')."""
    patterns = [
        # "SHM No 00169/tambakrejo" — capture full ref including /text part
        r"(?:SHM|SHGB|SHP|SHGU|SHSRS)\s+No\.?\s+(\d{5,}/[A-Za-z]+)",
        # Numeric only (fallback)
        r"(?:SHM|SHGB|SHP|SHGU|SHSRS|SERTIFIKAT)\s+(?:NO\.?|NOMOR)\s+(\d{5,})",
        r"(?:SHM|SHGB|SHP|SHGU|SHSRS|S\.H\.M)\s+([0-9]{5,})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return cleanup_inline(match.group(1))
    return ""


def extract_nomor_nib(text: str) -> str:
    """Extract NIB / nomor identifikasi bidang (e.g., 12391102.01324).

    In kwitansi it appears after sertifikat reference: 'SHM No 00169/tambakrejo nomor 12391102.01324'
    """
    patterns = [
        # "nomor 12391102.01324" immediately after sertifikat
        r"(?:SHM|SHGB|SHP|SHGU|SHSRS)\s+No[.\s]+[\w/]+\s+nomor\s+([\d.]+)",
        # "Nomor bukti kepemilikan ... 12391102.01324"
        r"(?:bukti\s+kepemilikan|identifikasi\s+bidang)\s+(\d{8,}(?:\.\d+)?)",
        # Standalone long number with dot (NIB format)
        r"\b(\d{11,14}\.\d{4,6})\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return cleanup_inline(match.group(1))
    return ""


def extract_tanggal_kwitansi(text: str) -> str:
    """Extract kwitansi date (e.g., 22 Desember 2025).

    The kwitansi date appears in signature line: 'Kota Surabaya, 22 Desember 2025'.
    """
    patterns = [
        # Date immediately after comma — matches "Kota Surabaya, 22 Desember 2025"
        rf",\s*(\d{{1,2}}\s+{BULAN_PATTERN}\s+\d{{4}})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return cleanup_inline(match.group(1))

    # Fallback: last date in text (kwitansi date is typically later than risalah date)
    dates = re.findall(DATE_PATTERN, text, re.IGNORECASE)
    if len(dates) > 1:
        return cleanup_inline(dates[-1])
    return cleanup_inline(dates[0]) if dates else ""


def parse_kwitansi_text(text: str) -> Dict:
    """Parse kwitansi PDF text and extract all relevant fields."""
    text = normalize_text(text)

    nomor_kwitansi = extract_nomor_kwitansi(text)
    nomor_risalah_lelang = extract_nomor_risalah_lelang(text)
    tanggal_risalah = extract_tanggal_risalah(text)
    luas = extract_luas(text)
    alamat = extract_alamat(text)
    singkatan_sertifikat = extract_singkatan_sertifikat(text)
    no_sertifikat = extract_no_sertifikat(text)
    nomor_nib = extract_nomor_nib(text)
    tanggal_kwitansi = extract_tanggal_kwitansi(text)
    nama_bank = extract_nama_bank(text)
    jenis_sertifikat = SERTIFIKAT_MAP.get(singkatan_sertifikat, "")

    parsed = {
        "nomor_kwitansi": nomor_kwitansi,
        "nomor_risalah_lelang": nomor_risalah_lelang,
        "tanggal_risalah": tanggal_risalah,
        "luas": luas,
        "alamat_desa": alamat.get("desa", ""),
        "alamat_kecamatan": alamat.get("kecamatan", ""),
        "alamat_kota": alamat.get("kota", ""),
        "alamat_provinsi": alamat.get("provinsi", ""),
        "singkatan_sertifikat": singkatan_sertifikat,
        "jenis_sertifikat": jenis_sertifikat,
        "no_sertifikat": no_sertifikat,
        "nomor_nib": nomor_nib,
        "tanggal_kwitansi": tanggal_kwitansi,
        "nama_bank": nama_bank,
    }

    score = 0
    if nomor_kwitansi:   score += 15
    if nomor_risalah_lelang: score += 10
    if tanggal_risalah:  score += 10
    if luas:             score += 10
    if alamat.get("desa") or alamat.get("kecamatan") or alamat.get("kota"): score += 20
    if singkatan_sertifikat: score += 10
    if no_sertifikat:    score += 10
    if tanggal_kwitansi: score += 15

    warnings = []
    if not nomor_kwitansi:
        warnings.append("Nomor kuitansi belum terbaca jelas.")
    if not nomor_risalah_lelang:
        warnings.append("Nomor risalah lelang belum terbaca jelas.")
    if not tanggal_risalah:
        warnings.append("Tanggal risalah belum terbaca jelas.")
    if not luas:
        warnings.append("Luas objek belum terbaca jelas.")
    if not singkatan_sertifikat:
        warnings.append("Jenis sertifikat (SHM/SHGB/dll) belum terbaca.")
    if not no_sertifikat:
        warnings.append("Nomor sertifikat belum terbaca jelas.")
    if not tanggal_kwitansi:
        warnings.append("Tanggal kuitansi belum terbaca jelas.")

    if score >= 75:
        status = "valid"
    elif score >= 40:
        status = "review"
    else:
        status = "invalid"

    return {
        "parsed": parsed,
        "score": score,
        "status": status,
        "warnings": warnings,
    }
