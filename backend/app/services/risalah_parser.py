import re
from typing import Dict


def normalize_text(text: str) -> str:
    text = text or ""
    text = text.replace("\r", "\n")
    text = text.replace("\t", " ")
    text = re.sub(r"[ ]{2,}", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def cleanup_inline(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip(" :;-\n\t")


def extract_nomor_risalah(text: str) -> str:
    patterns = [
        r"KUTIPAN\s+RISALAH\s+LELANG[\s\S]{0,150}?NOMOR\s*[:.]?\s*([A-Z0-9./-]+)",
        r"NOMOR\s*[:.]?\s*([A-Z0-9./-]{8,})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return cleanup_inline(match.group(1))

    return ""


def extract_tanggal_risalah(text: str) -> str:
    lines = [cleanup_inline(x) for x in text.splitlines() if cleanup_inline(x)]

    for i, line in enumerate(lines):
        if re.match(r"^Tanggal\b", line, re.IGNORECASE):
            inline = re.match(r"^Tanggal\s*[:.]?\s*(.+)$", line, re.IGNORECASE)
            if inline:
                candidate = cleanup_inline(inline.group(1))
                m = re.search(r"(\d{1,2}\s+[A-Za-z]+\s+\d{4})", candidate, re.IGNORECASE)
                if m:
                    return cleanup_inline(m.group(1))

            for j in range(i + 1, min(i + 4, len(lines))):
                candidate = lines[j]
                m = re.search(r"(\d{1,2}\s+[A-Za-z]+\s+\d{4})", candidate, re.IGNORECASE)
                if m:
                    return cleanup_inline(m.group(1))

    m = re.search(r"(\d{1,2}\s+[A-Za-z]+\s+\d{4})", text, re.IGNORECASE)
    return cleanup_inline(m.group(1)) if m else ""


def _normalize_gelar(name: str) -> str:
    """Normalize Indonesian academic title to abbreviation form."""
    name = re.sub(r"\bSarjana\s+Hukum\b",    "S.H.", name, flags=re.IGNORECASE)
    name = re.sub(r"\bSarjana\s+Ekonomi\b",  "S.E.", name, flags=re.IGNORECASE)
    name = re.sub(r"\bSarjana\s+Teknik\b",   "S.T.", name, flags=re.IGNORECASE)
    name = re.sub(r"\bSarjana\s+Hukum\b",    "S.H.", name, flags=re.IGNORECASE)
    # Normalise comma-separated gelar: ",SH" / ",S.H" → ", S.H."
    name = re.sub(r",\s*S\.?H\.?(?=\s|,|$)", ", S.H.", name, flags=re.IGNORECASE)
    name = re.sub(r",\s*S\.?E\.?(?=\s|,|$)", ", S.E.", name, flags=re.IGNORECASE)
    name = re.sub(r",\s*S\.?T\.?(?=\s|,|$)", ", S.T.", name, flags=re.IGNORECASE)
    return cleanup_inline(name)


def extract_pejabat_lelang(text: str) -> str:
    # Strategy 1: signature block — "Pejabat Lelang\nTtd.\nName,Gelar"
    # This is the most reliable because Vision OCR reads the bottom signature block together.
    m = re.search(
        r"Pejabat\s+Lelang\s*\n\s*Ttd[.,]?\s*\n\s*([^\n:]+)",
        text, re.IGNORECASE,
    )
    if m:
        val = cleanup_inline(m.group(1))
        if val and len(val) > 3:
            return _normalize_gelar(val)

    # Strategy 2: inline label "Pejabat Lelang : Name" (for digital PDFs)
    m = re.search(r"Pejabat\s+Lelang\s*[:]\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    if m:
        val = cleanup_inline(m.group(1))
        if val and len(val) > 3:
            return _normalize_gelar(val)

    # Strategy 3: name on the line(s) immediately after standalone "Pejabat Lelang" label
    lines = [x.strip() for x in text.splitlines()]
    for i, line in enumerate(lines):
        if re.fullmatch(r"Pejabat\s+Lelang", line, re.IGNORECASE):
            for j in range(i + 1, min(i + 5, len(lines))):
                candidate = cleanup_inline(lines[j])
                # Skip generic lines that are not a person's name
                if re.match(r"^(Ttd|NIP|\d|:|-|Nomor|Tanggal|Tempat|Pukul)", candidate, re.IGNORECASE):
                    continue
                if len(candidate) > 4 and re.search(r"[A-Za-z]{3}", candidate):
                    return _normalize_gelar(candidate)

    return ""


def extract_jam_lelang(text: str) -> str:
    # Strategy 1: time followed by spelled-out number + "Waktu Server"
    # e.g. "10:00 (sepuluh) Waktu Server aplikasi lelang..."
    m = re.search(
        r"(\d{1,2}[:.]\d{2})\s*\([^)]+\)\s*Waktu\s+Server",
        text, re.IGNORECASE,
    )
    if m:
        return m.group(1).replace(".", ":") + " WIB"

    # Strategy 2: "Pukul" label followed by time on same line (digital PDFs)
    m = re.search(r"Pukul\s*[:.]?\s*(\d{1,2}[:.]\d{2})", text, re.IGNORECASE)
    if m:
        return m.group(1).replace(".", ":") + " WIB"

    # Strategy 3: time at the very start of a line (OCR column-separated layout)
    m = re.search(r"^(\d{1,2}[:.]\d{2})\b", text, re.MULTILINE)
    if m:
        return m.group(1).replace(".", ":") + " WIB"

    return ""


def extract_nip_pejabat(text: str) -> str:
    """Extract pejabat lelang's NIP.
    In scanned risalah OCR, NIP appears in signature block as 'NIP 19760510 199503 1001'
    (no colon). In digital PDFs it appears as 'NIP : 19760510 199503 1 001'.
    """
    # Match "NIP" followed optionally by colon/space, then digit-and-space sequence
    m = re.search(r"\bNIP\s*[:.]?\s*(\d[\d\s]{10,22}\d)", text, re.IGNORECASE)
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip()
    return ""


def extract_uraian(text: str) -> str:
    normalized = normalize_text(text)

    start_match = re.search(r"\bUraian\b\s*[:.]?", normalized, re.IGNORECASE)
    if not start_match:
        return ""

    after = normalized[start_match.end():].strip()

    end_patterns = [
        r"\bNama Pembeli\b",
        r"\bNomor KTP/SIM/Paspor\b",
        r"\bAlamat\b",
        r"\bHarga Pembelian\b",
        r"\bPejabat Penjual\b",
        r"\bPembeli\b",
    ]

    cut_index = len(after)
    for pattern in end_patterns:
        m = re.search(pattern, after, re.IGNORECASE)
        if m and m.start() < cut_index:
            cut_index = m.start()

    uraian = after[:cut_index].strip()
    uraian = re.sub(r"\s+", " ", uraian).strip()

    return uraian


def parse_risalah_text(text: str) -> Dict:
    text = normalize_text(text)

    nomor_risalah = extract_nomor_risalah(text)
    tanggal_risalah = extract_tanggal_risalah(text)
    uraian = extract_uraian(text)
    pejabat_lelang = extract_pejabat_lelang(text)
    jam_lelang = extract_jam_lelang(text)
    nip = extract_nip_pejabat(text)

    parsed = {
        "nomor_risalah": nomor_risalah,
        "tanggal_risalah": tanggal_risalah,
        "uraian": uraian,
        "pejabat_lelang": pejabat_lelang,
        "jam_lelang": jam_lelang,
        "nip": nip,
    }

    score = 0
    if nomor_risalah:
        score += 30
    if tanggal_risalah:
        score += 20
    if uraian:
        score += 25
    if pejabat_lelang:
        score += 15
    if jam_lelang:
        score += 5
    if nip:
        score += 5

    warnings = []
    if not nomor_risalah:
        warnings.append("Nomor risalah belum terbaca jelas.")
    if not tanggal_risalah:
        warnings.append("Tanggal risalah belum terbaca jelas.")
    if not uraian:
        warnings.append("Uraian objek lelang belum terbaca jelas.")
    if not pejabat_lelang:
        warnings.append("Pejabat lelang belum terbaca jelas.")
    if not nip:
        warnings.append("NIP pejabat lelang belum terbaca jelas.")

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