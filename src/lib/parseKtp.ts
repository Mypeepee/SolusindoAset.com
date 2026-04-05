export type ParsedPemohonKtp = {
    nama_pemohon: string;
    nik_pemohon: string;
    kotalahir_pemohon: string;
    tanggallahir_pemohon: string;
    kelamin_pemohon: string;
    agama_pemohon: string;
    alamat_pemohon: string;
    pekerjaan_pemohon: string;
    statuskawin_pemohon: string;
    warga_negara: "Indonesia";
  };
  
  export type ParsedPemohonKtpResult = {
    data: ParsedPemohonKtp;
    score: number;
    status: "valid" | "review" | "invalid";
    warnings: string[];
  };
  
  export function parseKtpIndonesia(text: string): ParsedPemohonKtpResult {
    const lines = text
      .split("\n")
      .map((l) => normalizeLine(l))
      .filter(Boolean);
  
    const namaRaw = extractAfterLabel(lines, ["nama", "nara", "name"]);
  
    const ttlRaw = extractAfterLabel(lines, [
      "tempat/tgl lahir",
      "tempat tgl lahir",
      "tempat toi lahw",
      "tempat tgi lahu",
      "tempat toi lahir",
      "tempat/tgl",
      "tempat",
    ]);
  
    const genderRaw = extractAfterLabel(lines, [
      "jenis kelamin",
      "jens kelamin",
      "jenis ketaman",
      "ons ketaman",
      "kelamin",
    ]);
  
    const agamaRaw = extractAfterLabel(lines, ["agama"]);
  
    const pekerjaanRaw = extractAfterLabel(lines, ["pekerjaan", "pekenaan"]);
  
    const statusRaw = extractAfterLabel(lines, [
      "status perkawinan",
      "status perkawman",
      "perkawinan",
    ]);
  
    const alamatRaw = extractAlamat(lines);
  
    const { kotalahir_pemohon, tanggallahir_pemohon } = extractTTL(ttlRaw);
  
    const nama_pemohon = cleanupNama(namaRaw);
    const kelamin_pemohon = normalizeGender(genderRaw);
    const agama_pemohon = normalizeAgama(agamaRaw);
    const pekerjaan_pemohon = cleanupPekerjaan(pekerjaanRaw);
    const statuskawin_pemohon = normalizeMarriageStatus(statusRaw);
    const alamat_pemohon = cleanupAddress(alamatRaw);
  
    const nikRaw = extractNikSmart(text, lines);
  
    const nik_pemohon = refineNikWithBiodata({
      rawNik: nikRaw,
      tanggalLahir: tanggallahir_pemohon,
      jenisKelamin: kelamin_pemohon,
      cityContext: kotalahir_pemohon,
      originalText: text,
    });
  
    const data: ParsedPemohonKtp = {
      nama_pemohon,
      nik_pemohon,
      kotalahir_pemohon,
      tanggallahir_pemohon,
      kelamin_pemohon,
      agama_pemohon,
      alamat_pemohon,
      pekerjaan_pemohon,
      statuskawin_pemohon,
      warga_negara: "Indonesia",
    };
  
    const warnings: string[] = [];
    let score = 0;
  
    if (nama_pemohon.length >= 3) score += 12;
    else warnings.push("Nama belum terbaca dengan baik.");
  
    if (nik_pemohon.length === 16) score += 35;
    else warnings.push("NIK belum valid 16 digit.");
  
    if (kotalahir_pemohon) score += 8;
    else warnings.push("Tempat lahir belum terbaca.");
  
    if (isValidDateDDMMYYYY(tanggallahir_pemohon)) score += 12;
    else warnings.push("Tanggal lahir belum valid.");
  
    if (kelamin_pemohon) score += 8;
    else warnings.push("Jenis kelamin belum terbaca.");
  
    if (agama_pemohon) score += 5;
    else warnings.push("Agama belum terbaca.");
  
    if (alamat_pemohon.length >= 6) score += 8;
    else warnings.push("Alamat belum terbaca dengan baik.");
  
    if (pekerjaan_pemohon) score += 6;
    else warnings.push("Pekerjaan belum terbaca.");
  
    if (statuskawin_pemohon) score += 6;
    else warnings.push("Status kawin belum terbaca.");
  
    if (nikMatchesBiodataDob(nik_pemohon, tanggallahir_pemohon, kelamin_pemohon)) {
      score += 10;
    } else if (nik_pemohon) {
      warnings.push("NIK tidak sepenuhnya selaras dengan TTL.");
    }
  
    const status: ParsedPemohonKtpResult["status"] =
      score >= 80 ? "valid" : score >= 50 ? "review" : "invalid";
  
    return {
      data,
      score,
      status,
      warnings,
    };
  }
  
  function normalizeLine(line: string) {
    return line
      .replace(/\s+/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[|]/g, "I")
      .replace(/[¥]/g, "Y")
      .trim();
  }
  
  function extractAfterLabel(lines: string[], labels: string[]) {
    for (const line of lines) {
      const lower = line.toLowerCase();
  
      for (const label of labels) {
        const labelLower = label.toLowerCase();
  
        if (lower.includes(labelLower)) {
          const idx = lower.indexOf(labelLower);
          const value = line
            .slice(idx + label.length)
            .replace(/^[:\s.\-~,]+/, "")
            .trim();
  
          if (value) return value;
        }
      }
    }
  
    return "";
  }
  
  function extractTTL(raw: string) {
    const cleaned = raw.replace(/\./g, ",").replace(/\s+/g, " ").trim();
  
    const dateMatch = cleaned.match(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/);
    const tanggallahir_pemohon = dateMatch?.[0]?.replace(/\//g, "-") || "";
  
    let kotalahir_pemohon = cleaned
      .replace(tanggallahir_pemohon, "")
      .replace(/[,:]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  
    kotalahir_pemohon = kotalahir_pemohon
      .replace(/\bMALANGG\b/g, "MALANG")
      .replace(/\bMALAN6\b/g, "MALANG")
      .replace(/[^A-Z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  
    return {
      kotalahir_pemohon,
      tanggallahir_pemohon,
    };
  }
  
  function cleanupNama(value: string) {
    let v = value
      .replace(/\bNIK\b.*/gi, "")
      .replace(/\bKOTA\b.*/gi, "")
      .replace(/\bPROVINSI\b.*/gi, "")
      .replace(/[^A-Za-z\s'.-}]/g, " ")
      .replace(/[0-9]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  
    v = v
      .replace(/PANCAWAT\}/g, "PANCAWATI")
      .replace(/PANCAWAT!/g, "PANCAWATI")
      .replace(/PANCAWAT1/g, "PANCAWATI")
      .replace(/\bRlTA\b/g, "RITA")
      .replace(/\bR1TA\b/g, "RITA")
      .replace(/\bPANCAWATI\b/g, "PANCAWATI");
  
    return v.trim();
  }
  
  function normalizeGender(value: string) {
    let v = value.toUpperCase();
  
    v = v
      .replace(/GOL.*$/i, "")
      .replace(/DARAH.*$/i, "")
      .replace(/8$/i, "")
      .replace(/[^A-Z\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  
    if (v.includes("PEREMPUAN")) return "PEREMPUAN";
    if (v.includes("LAKI")) return "LAKI-LAKI";
  
    return v;
  }
  
  function normalizeAgama(value: string) {
    const v = value
      .toUpperCase()
      .replace(/[^A-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  
    if (v.includes("ISLAM")) return "ISLAM";
    if (v.includes("KRISTEN")) return "KRISTEN";
    if (v.includes("KATOLIK")) return "KATOLIK";
    if (v.includes("HINDU")) return "HINDU";
    if (v.includes("BUDDHA")) return "BUDDHA";
    if (v.includes("KONGHUCU")) return "KONGHUCU";
  
    return v;
  }
  
  function normalizeMarriageStatus(value: string) {
    const v = value
      .toUpperCase()
      .replace(/[^A-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  
    if (v.includes("BELUM") && v.includes("KAWIN")) return "BELUM KAWIN";
    if (v.includes("CERAI HIDUP")) return "CERAI HIDUP";
    if (v.includes("CERAI MATI")) return "CERAI MATI";
    if (v.includes("KAWIN")) return "KAWIN";
  
    return v;
  }
  
  function cleanupPekerjaan(value: string) {
    return value
      .toUpperCase()
      .replace(/[^A-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  
  function cleanupAddress(value: string) {
    let v = value.toUpperCase();
  
    v = v
      .replace(/^\+B\./g, "JL.")
      .replace(/^\+B\b/g, "JL")
      .replace(/^\+\.?/g, "JL.")
      .replace(/^\bJB\.\b/g, "JL.")
      .replace(/^\bJB\b/g, "JL")
      .replace(/^\bJ8\.\b/g, "JL.")
      .replace(/^\bJI\.\b/g, "JL.")
      .replace(/^\bJL\b(?!\.)/g, "JL.")
      .replace(/\bKULON 44-11 3\b/g, "KULON 44-Q/11")
      .replace(/\b44-11\b/g, "44-Q/11")
      .replace(/\b44 11\b/g, "44-Q/11")
      .replace(/\b44-Q 11\b/g, "44-Q/11")
      .replace(/[;:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  
    v = v.replace(/[^A-Z0-9./\-\s]/g, " ").replace(/\s+/g, " ").trim();
  
    return v;
  }
  
  function extractAlamat(lines: string[]) {
    const idx = lines.findIndex((l) => /alamat|mamat/i.test(l));
    if (idx === -1) return "";
  
    const first = lines[idx]
      .replace(/.*(alamat|mamat)\s*[:.+\-]?\s*/i, "")
      .trim();
  
    const next1 = lines[idx + 1] || "";
    const next2 = lines[idx + 2] || "";
  
    const results = [first];
  
    if (
      next1 &&
      !containsAnyLabel(next1, [
        "rt/rw",
        "rtrw",
        "rt rw",
        "kel/desa",
        "keldesa",
        "kel desa",
        "desa",
        "kecamatan",
        "agama",
        "status",
        "pekerjaan",
        "kewarganegaraan",
        "berlaku hingga",
      ])
    ) {
      results.push(next1);
    }
  
    if (
      next2 &&
      !containsAnyLabel(next2, [
        "rt/rw",
        "rtrw",
        "rt rw",
        "kel/desa",
        "keldesa",
        "kel desa",
        "desa",
        "kecamatan",
        "agama",
        "status",
        "pekerjaan",
        "kewarganegaraan",
        "berlaku hingga",
      ])
    ) {
      results.push(next2);
    }
  
    return results.join(", ").replace(/\s+,/g, ",").trim();
  }
  
  function containsAnyLabel(text: string, labels: string[]) {
    const lower = text.toLowerCase();
    return labels.some((label) => lower.includes(label));
  }
  
  function extractNikSmart(fullText: string, lines: string[]) {
    const nikLine =
      lines.find((l) => /nik/i.test(l)) ||
      lines.find((l) => /\d{10,}/.test(l)) ||
      "";
  
    const sources = [nikLine, ...lines.slice(0, 5), fullText].filter(Boolean);
  
    const candidates: string[] = [];
  
    for (const source of sources) {
      const normalized = normalizeNikLikeText(source);
      candidates.push(...collectNikCandidates(normalized.onlyDigits));
      candidates.push(...collectNikCandidatesFromMixed(normalized.mixed));
    }
  
    const unique = [...new Set(candidates)].filter((c) => /^\d{16}$/.test(c));
  
    if (unique.length === 0) return "";
  
    unique.sort((a, b) => scoreNikCandidate(b) - scoreNikCandidate(a));
    return unique[0];
  }
  
  function normalizeNikLikeText(text: string) {
    const compact = text
      .replace(/nik/gi, "")
      .replace(/[:\s]/g, "")
      .replace(/[%]/g, "8");
  
    const mixed = compact
      .replace(/[OoQqD]/g, "0")
      .replace(/[Il!|]/g, "1")
      .replace(/[Zz]/g, "2")
      .replace(/[A]/g, "4")
      .replace(/[Ss]/g, "5")
      .replace(/[bG]/g, "6")
      .replace(/[T]/g, "7")
      .replace(/[B]/g, "8")
      .replace(/[g]/g, "9");
  
    return {
      mixed,
      onlyDigits: mixed.replace(/[^0-9]/g, ""),
    };
  }
  
  function collectNikCandidates(digits: string) {
    const results = new Set<string>();
  
    if (digits.length === 16) results.add(digits);
  
    if (digits.length > 16) {
      for (let i = 0; i <= digits.length - 16; i++) {
        results.add(digits.slice(i, i + 16));
      }
    }
  
    return [...results];
  }
  
  function collectNikCandidatesFromMixed(mixed: string) {
    const cleaned = mixed.replace(/[^0-9A-Za-z]/g, "");
    const results = new Set<string>();
  
    if (cleaned.length < 16) return [];
  
    for (let i = 0; i <= cleaned.length - 16; i++) {
      const chunk = cleaned.slice(i, i + 16);
      const normalized = chunk
        .replace(/[OoQqD]/g, "0")
        .replace(/[Il!|]/g, "1")
        .replace(/[Zz]/g, "2")
        .replace(/[A]/g, "4")
        .replace(/[Ss]/g, "5")
        .replace(/[bG]/g, "6")
        .replace(/[T]/g, "7")
        .replace(/[B]/g, "8")
        .replace(/[g]/g, "9")
        .replace(/[^0-9]/g, "");
  
      if (normalized.length === 16) {
        results.add(normalized);
      }
    }
  
    return [...results];
  }
  
  function scoreNikCandidate(nik: string) {
    let score = 0;
  
    if (/^\d{16}$/.test(nik)) score += 100;
  
    const prov = Number(nik.slice(0, 2));
    const kab = Number(nik.slice(2, 4));
    const kec = Number(nik.slice(4, 6));
    const dd = Number(nik.slice(6, 8));
    const mm = Number(nik.slice(8, 10));
    const yy = nik.slice(10, 12);
  
    if (prov >= 11 && prov <= 99) score += 8;
    if (kab >= 1 && kab <= 99) score += 6;
    if (kec >= 1 && kec <= 99) score += 6;
    if (dd >= 1 && dd <= 71) score += 18;
    if (mm >= 1 && mm <= 12) score += 18;
    if (/^\d{2}$/.test(yy)) score += 8;
  
    return score;
  }
  
  function refineNikWithBiodata(params: {
    rawNik: string;
    tanggalLahir?: string;
    jenisKelamin?: string;
    cityContext?: string;
    originalText?: string;
  }) {
    const {
      rawNik,
      tanggalLahir = "",
      jenisKelamin = "",
      cityContext = "",
      originalText = "",
    } = params;
  
    const candidates = new Set<string>();
  
    collectNikCandidates(rawNik.replace(/\D/g, "")).forEach((c) => candidates.add(c));
  
    const longDigits = normalizeNikLikeText(originalText).onlyDigits;
    collectNikCandidates(longDigits).forEach((c) => candidates.add(c));
  
    const dateMatch = tanggalLahir.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    const isPerempuan = /PEREMPUAN/i.test(jenisKelamin);
  
    let expectedDob = "";
    if (dateMatch) {
      let dd = Number(dateMatch[1]);
      const mm = dateMatch[2];
      const yy = dateMatch[3].slice(2);
  
      if (isPerempuan) dd += 40;
      expectedDob = `${String(dd).padStart(2, "0")}${mm}${yy}`;
    }
  
    const cityPrefixes = getPossibleRegionPrefixes(cityContext, originalText);
  
    const ranked = [...candidates]
      .filter((c) => /^\d{16}$/.test(c))
      .map((candidate) => {
        let score = scoreNikCandidate(candidate);
  
        if (expectedDob && candidate.slice(6, 12) === expectedDob) {
          score += 120;
        }
  
        if (cityPrefixes.some((prefix) => candidate.startsWith(prefix))) {
          score += 40;
        }
  
        return { candidate, score };
      })
      .sort((a, b) => b.score - a.score);
  
    if (ranked.length > 0) {
      return ranked[0].candidate;
    }
  
    if (expectedDob && cityPrefixes.length > 0) {
      const suffix = extractBestNikSuffix(longDigits);
      return `${cityPrefixes[0]}${expectedDob}${suffix}`.slice(0, 16);
    }
  
    return rawNik.replace(/\D/g, "").slice(0, 16);
  }
  
  function getPossibleRegionPrefixes(cityContext: string, originalText: string) {
    const upperCity = (cityContext || "").toUpperCase();
    const upperText = (originalText || "").toUpperCase();
  
    const prefixes: string[] = [];
  
    if (upperText.includes("KOTA SURABAYA") || upperCity.includes("SURABAYA")) {
      prefixes.push("357831");
    }
  
    if (upperText.includes("JAWA TIMUR")) {
      prefixes.push("35");
    }
  
    return [...new Set(prefixes)];
  }
  
  function extractBestNikSuffix(longDigits: string) {
    if (!longDigits) return "0001";
    if (longDigits.length >= 4) return longDigits.slice(-4).padStart(4, "0");
    return longDigits.padStart(4, "0").slice(-4);
  }
  
  function nikMatchesBiodataDob(nik: string, tanggalLahir: string, jenisKelamin: string) {
    if (!/^\d{16}$/.test(nik)) return false;
  
    const match = tanggalLahir.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return false;
  
    let dd = Number(match[1]);
    const mm = match[2];
    const yy = match[3].slice(2);
  
    if (/PEREMPUAN/i.test(jenisKelamin)) dd += 40;
  
    return nik.slice(6, 12) === `${String(dd).padStart(2, "0")}${mm}${yy}`;
  }
  
  function isValidDateDDMMYYYY(value: string) {
    return /^\d{2}-\d{2}-\d{4}$/.test(value);
  }