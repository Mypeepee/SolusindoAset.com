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

    parsed = {
        "nomor_risalah": nomor_risalah,
        "tanggal_risalah": tanggal_risalah,
        "uraian": uraian,
    }

    score = 0
    if nomor_risalah:
        score += 35
    if tanggal_risalah:
        score += 25
    if uraian:
        score += 40

    warnings = []
    if not nomor_risalah:
        warnings.append("Nomor risalah belum terbaca jelas.")
    if not tanggal_risalah:
        warnings.append("Tanggal risalah belum terbaca jelas.")
    if not uraian:
        warnings.append("Uraian objek lelang belum terbaca jelas.")

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