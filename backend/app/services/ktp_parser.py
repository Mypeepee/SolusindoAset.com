import re
from typing import List, Tuple, Dict


def normalize_text(text: str) -> str:
    text = text or ""
    text = text.replace("\r", "\n")
    text = text.replace("\t", " ")
    text = re.sub(r"[ ]{2,}", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def cleanup_value(value: str) -> str:
    value = value or ""
    value = value.replace("|", "I")
    value = value.replace(";", ":")
    value = value.replace("'", "")
    value = value.replace("`", "")
    value = re.sub(r"[ ]{2,}", " ", value)
    return value.strip(" :;-\n\t")


def upper_no_space(s: str) -> str:
    return re.sub(r"[^A-Z]", "", (s or "").upper())


def normalize_title_keep_roman(s: str) -> str:
    """
    Title case biasa, tapi tetap menjaga token romawi / blok alamat tertentu.
    """
    if not s:
        return ""

    roman_tokens = {
        "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
        "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"
    }

    parts = []
    for token in s.split():
        clean = re.sub(r"[^A-Za-z0-9/.-]", "", token.upper())
        if clean in roman_tokens:
            parts.append(clean)
        elif token.upper() in {"JL", "JLN", "GG", "NO", "BLOK", "RT", "RW"}:
            parts.append(token.upper())
        else:
            parts.append(token.capitalize())

    return " ".join(parts)


def is_noise_line(line: str) -> bool:
    normalized = upper_no_space(line)

    noise_keywords = {
        "NIK",
        "NAMA",
        "TEMPATTGLLAHIR",
        "JENISKELAMIN",
        "GOLDARAH",
        "ALAMAT",
        "RTRW",
        "KELDESA",
        "KELURAHAN",
        "DESA",
        "KECAMATAN",
        "AGAMA",
        "STATUSPERKAWINAN",
        "PEKERJAAN",
        "KEWARGANEGARAAN",
        "BERLAKUHINGGA",
        "KARTUTANDA",
        "PENDUDUK",
        "REPUBLIKINDONESIA",
        "ARTUTANM",
        "KARTUTAN",
        "DUD",
        "END",
        "DA",
        "SDUDUK",
        "RTU",
        "NDUDUKKAS",
        "LAPENDUDUKKART",
        "EDUDUKKART",
        "ENDUKKARTO",
        "ARTUTAN",
        "KARTUTANM",
        "KARTUTANPENDUDUK",
        "KARTUTANDAPENDUDUK",
        "PENDUDUKKART",
        "GOLDARAHB",
    }

    if not normalized:
        return True

    if normalized in noise_keywords:
        return True

    if len(normalized) <= 2 and normalized in {"DA", "DUD", "END", "RTU"}:
        return True

    return False


def is_field_label(line: str) -> bool:
    cleaned = cleanup_value(line)
    upper = cleaned.upper()

    patterns = [
        r"^NIK$",
        r"^NAMA$",
        r"^TEMPAT\s*/?\s*TGL\s*LAHIR$",
        r"^JENIS\s*KELAMIN$",
        r"^GOL\.?\s*DARAH$",
        r"^ALAMAT$",
        r"^RT\s*/?\s*RW$",
        r"^RTRW$",
        r"^KEL/?DESA$",
        r"^KELDESA$",
        r"^KELURAHAN$",
        r"^DESA$",
        r"^KECAMATAN$",
        r"^AGAMA$",
        r"^STATUS\s*PERKAWINAN$",
        r"^PEKERJAAN$",
        r"^KEWARGANEGARAAN$",
        r"^BERLAKU\s*HINGGA$",
        r"^PROVINSI.*$",
        r"^KOTA.*$",
        r"^KABUPATEN.*$",
    ]

    return any(re.match(p, upper, re.IGNORECASE) for p in patterns)


def find_nik(text: str) -> str:
    matches = re.findall(r"\b\d{16}\b", text)
    return matches[0] if matches else ""


def extract_city_info(lines: List[str]) -> Tuple[str, str]:
    for line in lines:
        cleaned = cleanup_value(line)
        upper = cleaned.upper()

        m1 = re.match(r"^KOTA\s+(.+)$", upper)
        if m1:
            return "Kota", normalize_title_keep_roman(cleanup_value(m1.group(1)))

        m2 = re.match(r"^KABUPATEN\s+(.+)$", upper)
        if m2:
            return "Kabupaten", normalize_title_keep_roman(cleanup_value(m2.group(1)))

    return "", ""


def looks_like_name(line: str) -> bool:
    line = cleanup_value(line)
    if not line or re.search(r"\d", line):
        return False

    upper = line.upper()
    blocked = [
        "PROVINSI", "KOTA", "KABUPATEN", "NIK", "NAMA", "TEMPAT",
        "JENIS", "KELAMIN", "ALAMAT", "RTRW", "KELDESA", "KECAMATAN",
        "AGAMA", "STATUS", "PEKERJAAN", "KEWARGANEGARAAN", "BERLAKU",
        "GOL", "DARAH", "KARTU", "PENDUDUK"
    ]
    if any(word in upper for word in blocked):
        return False

    return len(upper.split()) >= 2


def parse_ttl_value(value: str) -> Tuple[str, str]:
    value = cleanup_value(value)
    match = re.search(r"(.+?),\s*(\d{2}[-/]\d{2}[-/]\d{4})", value)
    if match:
        kota = normalize_title_keep_roman(cleanup_value(match.group(1)))
        tanggal = match.group(2).replace("/", "-")
        return kota, tanggal
    return "", ""


def extract_nama(lines: List[str]) -> str:
    for i, line in enumerate(lines):
        cleaned = cleanup_value(line)

        if re.fullmatch(r"Nama", cleaned, re.IGNORECASE):
            for j in range(i + 1, min(i + 10, len(lines))):
                candidate = cleanup_value(lines[j])
                if looks_like_name(candidate):
                    return normalize_title_keep_roman(candidate)

        if re.match(r"^Nama\s*[:\-]", cleaned, re.IGNORECASE):
            candidate = re.sub(r"^Nama\s*[:\-]?\s*", "", cleaned, flags=re.IGNORECASE)
            candidate = cleanup_value(candidate)
            if looks_like_name(candidate):
                return normalize_title_keep_roman(candidate)

    for line in lines:
        candidate = cleanup_value(line)
        if looks_like_name(candidate):
            return normalize_title_keep_roman(candidate)

    return ""


def extract_ttl(lines: List[str]) -> Tuple[str, str]:
    for i, line in enumerate(lines):
        cleaned = cleanup_value(line)

        if re.search(r"Tempat\s*/?\s*Tgl\s*Lahir", cleaned, re.IGNORECASE):
            same_line_match = re.search(
                r"Tempat\s*/?\s*Tgl\s*Lahir\s*[:\-]?\s*(.+)",
                cleaned,
                re.IGNORECASE,
            )
            if same_line_match:
                parsed = parse_ttl_value(same_line_match.group(1))
                if parsed != ("", ""):
                    return parsed

            for j in range(i + 1, min(i + 6, len(lines))):
                candidate = cleanup_value(lines[j])
                parsed = parse_ttl_value(candidate)
                if parsed != ("", ""):
                    return parsed

    for line in lines:
        parsed = parse_ttl_value(line)
        if parsed != ("", ""):
            return parsed

    return "", ""


def extract_kelamin(text: str) -> str:
    upper_text = text.upper()

    if "PEREMPUAN" in upper_text:
        return "Perempuan"
    if "LAKI-LAKI" in upper_text or "LAKI LAKI" in upper_text:
        return "Laki-laki"

    return ""


def extract_agama(text: str) -> str:
    agama_map = {
        "ISLAM": "Islam",
        "KRISTEN": "Kristen",
        "KATOLIK": "Katolik",
        "HINDU": "Hindu",
        "BUDDHA": "Buddha",
        "BUDHA": "Buddha",
        "KONGHUCU": "Konghucu",
    }

    upper_text = text.upper()
    for k, v in agama_map.items():
        if re.search(rf"\b{k}\b", upper_text):
            return v

    return ""


def extract_status_kawin(text: str) -> str:
    upper_text = text.upper()

    candidates = [
        ("BELUM KAWIN", "Belum Kawin"),
        ("KAWIN", "Kawin"),
        ("CERAI HIDUP", "Cerai Hidup"),
        ("CERAI MATI", "Cerai Mati"),
    ]

    for raw, normal in candidates:
        if raw in upper_text:
            return normal

    return ""


def extract_pekerjaan(lines: List[str]) -> str:
    for i, line in enumerate(lines):
        cleaned = cleanup_value(line)

        if re.search(r"Pekerjaan", cleaned, re.IGNORECASE):
            same_line = re.sub(r"Pekerjaan", "", cleaned, flags=re.IGNORECASE).strip(" :;-")
            if same_line:
                return normalize_title_keep_roman(cleanup_value(same_line))

            for j in range(i + 1, min(i + 5, len(lines))):
                candidate = cleanup_value(lines[j])
                if candidate and not is_noise_line(candidate) and not is_field_label(candidate):
                    return normalize_title_keep_roman(candidate)

    return ""


def extract_kewarganegaraan(text: str) -> str:
    upper = text.upper()
    if "WNI" in upper:
        return "Indonesia"
    if "WNA" in upper:
        return "WNA"
    return "Indonesia"


def looks_like_ttl(line: str) -> bool:
    line = cleanup_value(line)
    return bool(re.search(r".+?,\s*\d{2}[-/]\d{2}[-/]\d{4}", line))


def looks_like_gender(line: str) -> bool:
    upper = cleanup_value(line).upper()
    return "PEREMPUAN" in upper or "LAKI" in upper


def looks_like_blood_type(line: str) -> bool:
    upper = cleanup_value(line).upper()
    return "GOL" in upper and "DARAH" in upper


def looks_like_kelurahan_value(line: str) -> bool:
    line = cleanup_value(line)
    upper = line.upper()

    if not line:
        return False
    if is_noise_line(line):
        return False
    if is_field_label(line):
        return False
    if looks_like_ttl(line):
        return False
    if looks_like_gender(line):
        return False
    if looks_like_blood_type(line):
        return False
    if re.fullmatch(r"\d{2,3}/\d{2,3}", line):
        return False
    if re.search(r"\d", line):
        return False
    if "PROVINSI" in upper or "KOTA " in upper or "KABUPATEN" in upper:
        return False
    if len(upper.split()) > 4:
        return False

    return True


def looks_like_kecamatan_value(line: str) -> bool:
    return looks_like_kelurahan_value(line)


def looks_like_address(line: str) -> bool:
    line = cleanup_value(line)
    upper = line.upper()

    if not line:
        return False
    if is_noise_line(line):
        return False
    if is_field_label(line):
        return False
    if looks_like_ttl(line):
        return False
    if looks_like_gender(line):
        return False
    if looks_like_blood_type(line):
        return False
    if re.fullmatch(r"\d{16}", line):
        return False
    if re.fullmatch(r"\d{2,3}/\d{2,3}", line):
        return False
    if upper in {"WNI", "WNA", "ISLAM", "KRISTEN", "KATOLIK", "HINDU", "BUDDHA", "KONGHUCU"}:
        return False

    address_keywords = [
        "JL", "JLN", "JALAN", "GANG", "GG", "PERUM", "BLOK", "NO",
        "KIDUL", "KULON", "WETAN", "LOR", "UTARA", "SELATAN", "TIMUR", "BARAT"
    ]

    if any(re.search(rf"\b{k}\b", upper) for k in address_keywords):
        return True

    # contoh: SIMO KATRUNGAN KIDUL VII/2A
    if re.search(r"\b[IVXLCDM]+\s*/\s*\d+[A-Z]?\b", upper):
        return True

    # contoh: 44-Q/11, 7/6, 10A/2
    if re.search(r"\b\d+[A-Z]?(?:[-/][A-Z0-9]+)+\b", upper):
        return True

    if re.search(r"\d", upper) and len(upper.split()) >= 2:
        return True

    return False


def find_label_index(lines: List[str], patterns: List[str]) -> int:
    for i, line in enumerate(lines):
        cleaned = cleanup_value(line)
        for pattern in patterns:
            if re.fullmatch(pattern, cleaned, re.IGNORECASE) or re.match(
                rf"{pattern}\s*[:\-]?.*$", cleaned, re.IGNORECASE
            ):
                return i
    return -1


def get_inline_value(line: str, label_patterns: List[str]) -> str:
    cleaned = cleanup_value(line)
    for pattern in label_patterns:
        m = re.match(rf"^(?:{pattern})\s*[:\-]?\s*(.+)$", cleaned, re.IGNORECASE)
        if m:
            value = cleanup_value(m.group(1))
            if value:
                return value
    return ""


def get_address_block(lines: List[str]) -> Tuple[int, int, List[str]]:
    """
    Ambil blok alamat secara lebih longgar:
    - mulai beberapa baris sebelum label alamat/rtrw/kel/kec
    - berhenti sebelum section agama/status/pekerjaan/dst
    """
    alamat_idx = find_label_index(lines, [r"Alamat"])
    rtrw_idx = find_label_index(lines, [r"RT\s*/?\s*RW", r"RTRW"])
    kel_idx = find_label_index(lines, [r"Kel/?Desa", r"KelDesa", r"Kelurahan", r"Desa"])
    kec_idx = find_label_index(lines, [r"Kecamatan"])

    indices = [i for i in [alamat_idx, rtrw_idx, kel_idx, kec_idx] if i != -1]

    if not indices:
        return 0, len(lines), lines

    start = max(0, min(indices) - 5)
    end = min(len(lines), max(indices) + 8)

    stop_patterns = [
        r"^Agama$",
        r"^Status\s*Perkawinan.*$",
        r"^Pekerjaan$",
        r"^Kewarganegaraan.*$",
        r"^Berlaku\s*Hingga.*$",
    ]

    for i in range(max(indices) + 1, len(lines)):
        cleaned = cleanup_value(lines[i])
        if any(re.match(p, cleaned, re.IGNORECASE) for p in stop_patterns):
            end = i
            break

    return start, end, lines[start:end]


def extract_rt_rw(block: List[str]) -> str:
    idx = find_label_index(block, [r"RT\s*/?\s*RW", r"RTRW"])

    if idx != -1:
        inline = get_inline_value(block[idx], [r"RT\s*/?\s*RW", r"RTRW"])
        if inline:
            m = re.search(r"(\d{2,3}\s*/\s*\d{2,3})", inline)
            if m:
                return m.group(1).replace(" ", "")

        for j in range(max(0, idx - 2), min(len(block), idx + 4)):
            candidate = cleanup_value(block[j])
            m = re.search(r"(\d{2,3}\s*/\s*\d{2,3})", candidate)
            if m:
                return m.group(1).replace(" ", "")

    for line in block:
        cleaned = cleanup_value(line)
        m = re.search(r"(\d{2,3}\s*/\s*\d{2,3})", cleaned)
        if m:
            return m.group(1).replace(" ", "")

    return ""


def extract_kecamatan(block: List[str]) -> str:
    idx = find_label_index(block, [r"Kecamatan"])
    if idx == -1:
        return ""

    inline = get_inline_value(block[idx], [r"Kecamatan"])
    if inline and looks_like_kecamatan_value(inline):
        return normalize_title_keep_roman(inline)

    candidates = []
    for j in range(idx + 1, min(idx + 5, len(block))):
        candidate = cleanup_value(block[j])
        if looks_like_kecamatan_value(candidate):
            candidates.append(candidate)

    if candidates:
        return normalize_title_keep_roman(candidates[0])

    return ""


def extract_kelurahan(block: List[str]) -> str:
    idx = find_label_index(block, [r"Kel/?Desa", r"KelDesa", r"Kelurahan", r"Desa"])
    if idx == -1:
        return ""

    inline = get_inline_value(block[idx], [r"Kel/?Desa", r"KelDesa", r"Kelurahan", r"Desa"])
    if inline and looks_like_kelurahan_value(inline):
        return normalize_title_keep_roman(inline)

    next_boundary = len(block)
    kec_idx_relative = find_label_index(block[idx + 1:], [r"Kecamatan"])
    if kec_idx_relative != -1:
        next_boundary = idx + 1 + kec_idx_relative

    candidates = []
    for j in range(idx + 1, next_boundary):
        candidate = cleanup_value(block[j])
        if looks_like_kelurahan_value(candidate):
            candidates.append(candidate)

    # lebih aman ambil kandidat terakhir sebelum Kecamatan
    if candidates:
        return normalize_title_keep_roman(candidates[-1])

    return ""


def extract_alamat_utama(block: List[str]) -> str:
    """
    Strategi:
    1. coba inline di label Alamat
    2. cari kandidat di sekitar label Alamat / RT/RW
    3. fallback ke kandidat address-like dengan skor terbaik
    """
    alamat_idx = find_label_index(block, [r"Alamat"])
    rtrw_idx = find_label_index(block, [r"RT\s*/?\s*RW", r"RTRW"])

    if alamat_idx != -1:
        inline = get_inline_value(block[alamat_idx], [r"Alamat"])
        if inline and looks_like_address(inline):
            return normalize_title_keep_roman(inline)

    scored_candidates = []

    anchors = [i for i in [alamat_idx, rtrw_idx] if i != -1]

    if anchors:
        for anchor in anchors:
            for j in range(max(0, anchor - 4), min(len(block), anchor + 4)):
                candidate = cleanup_value(block[j])
                if not looks_like_address(candidate):
                    continue

                score = 100 - (abs(j - anchor) * 10)

                # sedikit boost kalau muncul sebelum/sama dengan RT/RW
                if rtrw_idx != -1 and j < rtrw_idx:
                    score += 12

                # boost kalau dekat dengan label Alamat
                if alamat_idx != -1 and abs(j - alamat_idx) <= 1:
                    score += 10

                # boost bila ada keyword jalan
                upper = candidate.upper()
                if re.search(r"\b(JL|JLN|JALAN|GG|GANG|PERUM)\b", upper):
                    score += 12

                scored_candidates.append((score, candidate))

    if not scored_candidates:
        for j, line in enumerate(block):
            candidate = cleanup_value(line)
            if looks_like_address(candidate):
                score = 50
                upper = candidate.upper()

                if re.search(r"\b(JL|JLN|JALAN|GG|GANG|PERUM)\b", upper):
                    score += 12
                if re.search(r"\d", upper):
                    score += 8

                scored_candidates.append((score, candidate))

    if not scored_candidates:
        return ""

    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    return normalize_title_keep_roman(scored_candidates[0][1])


def extract_alamat_components(lines: List[str]) -> Tuple[str, str, str, str]:
    _, _, block = get_address_block(lines)

    alamat = extract_alamat_utama(block)
    rt_rw = extract_rt_rw(block)
    kelurahan = extract_kelurahan(block)
    kecamatan = extract_kecamatan(block)

    return alamat, rt_rw, kelurahan, kecamatan


def compose_full_address(
    alamat: str,
    rt_rw: str,
    kelurahan: str,
    kecamatan: str,
    city_type: str,
    city_name: str,
) -> str:
    parts = []

    if alamat:
        parts.append(alamat)
    if rt_rw:
        parts.append(f"RT/RW {rt_rw}")
    if kelurahan:
        parts.append(f"Kel. {kelurahan}")
    if kecamatan:
        parts.append(f"Kec. {kecamatan}")

    if city_name:
        if city_type == "Kota":
            parts.append(f"Kota {city_name}")
        elif city_type == "Kabupaten":
            parts.append(f"Kabupaten {city_name}")
        else:
            parts.append(city_name)

    return ", ".join(parts)


def parse_ktp_text(text: str) -> Dict:
    text = normalize_text(text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    nik = find_nik(text)
    nama = extract_nama(lines)
    kota_lahir, tanggal_lahir = extract_ttl(lines)
    kelamin = extract_kelamin(text)
    agama = extract_agama(text)
    pekerjaan = extract_pekerjaan(lines)
    statuskawin = extract_status_kawin(text)
    warga_negara = extract_kewarganegaraan(text)

    city_type, city_name = extract_city_info(lines)
    alamat_utama, rt_rw, kelurahan, kecamatan = extract_alamat_components(lines)

    alamat_full = compose_full_address(
        alamat=alamat_utama,
        rt_rw=rt_rw,
        kelurahan=kelurahan,
        kecamatan=kecamatan,
        city_type=city_type,
        city_name=city_name,
    )

    parsed = {
        "nama_pemohon": nama,
        "nik_pemohon": nik,
        "kotalahir_pemohon": kota_lahir,
        "tanggallahir_pemohon": tanggal_lahir,
        "kelamin_pemohon": kelamin,
        "agama_pemohon": agama,
        "alamat_pemohon": alamat_full,
        "alamat_utama_pemohon": alamat_utama,
        "kelurahan_pemohon": kelurahan,
        "kecamatan_pemohon": kecamatan,
        "kota_pemohon": city_name,
        "jenis_kota_pemohon": city_type,
        "rt_rw_pemohon": rt_rw,
        "pekerjaan_pemohon": pekerjaan,
        "statuskawin_pemohon": statuskawin,
        "warga_negara": warga_negara,
    }

    score = 0
    if parsed["nama_pemohon"]:
        score += 10
    if re.fullmatch(r"\d{16}", parsed["nik_pemohon"] or ""):
        score += 30
    if parsed["kotalahir_pemohon"]:
        score += 10
    if parsed["tanggallahir_pemohon"]:
        score += 10
    if parsed["kelamin_pemohon"]:
        score += 10
    if parsed["agama_pemohon"]:
        score += 10
    if parsed["alamat_pemohon"]:
        score += 10
    if parsed["pekerjaan_pemohon"]:
        score += 5
    if parsed["statuskawin_pemohon"]:
        score += 5

    warnings = []
    if not re.fullmatch(r"\d{16}", parsed["nik_pemohon"] or ""):
        warnings.append("NIK tidak valid atau belum terbaca 16 digit.")
    if not parsed["nama_pemohon"]:
        warnings.append("Nama belum terbaca jelas.")
    if not parsed["alamat_pemohon"]:
        warnings.append("Alamat belum terbaca lengkap.")
    if not parsed["tanggallahir_pemohon"]:
        warnings.append("Tanggal lahir belum terbaca jelas.")

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


if __name__ == "__main__":
    sample_text_1 = """
    NIK
    Nama
    PROVINSI JAWA TIMUR
    KOTA SURABAYA
    : 3578316212670001
    Tempat/Tgl Lahir
    Jenis Kelamin
    Alamat
    RTRW
    KelDesa
    RITA PANCAWATI
    MALANG, 22-12-1967
    PEREMPUAN
    Gol Darah B
    JL.CANDI LONTAR KULON 44-Q/11
    :003/008
    LONTAR
    Kecamatan SAMBI KEREP
    Agama
    ISLAM
    Status Perkawinan: KAWIN
    Pekerjaan
    MENGURUS RUMAH TANGGA
    Kewarganegaraan: WNI
    Berlaku Hingga : 22-12-2017
    """

    sample_text_2 = """
    NIK
    Nama
    Tempat/Tgl Lahir
    Jenis kelamin
    PROVINSI JAWA TIMUR
    KOTA SURABAYA
    3316057105990006
    VENATHA TANOTO
    BLORA, 31-05-1999
    PEREMPUAN
    Gol. Darah
    SIMO KATRUNGAN KIDUL VII/2A
    001/001
    Alamat
    RT/RW
    Kel/Desa
    BANYU URIP
    Kecamatan
    SAWAHAN
    Agama
    KRISTEN
    Status Perkawinan BELUM KAWIN
    Pekerjaan
    BELUM/TIDAK BEKERJA
    Kewarganegaraan: WNI
    Berlaku Hingga
    SEUMUR HIDUP
    """

    sample_text_3 = """
    NIK
    Nama
    PROVINSI JAWA TIMUR
    KOTA SURABAYA
    = 3514120108030002
    JASON CHRISTOPHER LIENDO
    Tempat/Tgl Lahir : PASURUAN, 01-08-2003
    Jenis kelamin
    Alamat
    RT/RW
    Kel/Desa
    : LAKI-LAKI
    Gol, Darah :-
    : SIMO KATRUNGAN KIDUL 7/6
    : 001/001
    : BANYU URIP
    Kecamatan ; SAWAHAN
    Agama
    Status Perkawinan BELUM KAWIN
    Pekerjaan
    : KRISTEN
    : BELUM/TIDAK BEKERJA
    Kewarganegaraan: WNI
    Berlaku Hingga : SEUMUR HIDUP
    """

    for idx, sample in enumerate([sample_text_1, sample_text_2, sample_text_3], start=1):
        result = parse_ktp_text(sample)
        print(f"\n=== SAMPLE {idx} ===")
        print(result["parsed"]["alamat_pemohon"])
        print(result)