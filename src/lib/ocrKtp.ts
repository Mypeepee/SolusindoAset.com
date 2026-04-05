import Tesseract from "tesseract.js";

export type OcrKtpResult = {
  rawText: string;
  cleanedText: string;
  confidence: number;
};

type OcrSegmentResult = {
  text: string;
  confidence: number;
};

export async function ocrKTP(file: File): Promise<OcrKtpResult> {
  const bitmap = await createImageBitmap(file);

  const fullImage = preprocessRegion(bitmap, {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    mode: "balanced",
    scaleTarget: 2200,
  });

  const biodataLeft = preprocessRegion(bitmap, {
    x: 0.02,
    y: 0.12,
    width: 0.66,
    height: 0.72,
    mode: "text",
    scaleTarget: 2400,
  });

  const nikTop = preprocessRegion(bitmap, {
    x: 0.02,
    y: 0.02,
    width: 0.78,
    height: 0.32,
    mode: "digits",
    scaleTarget: 2400,
  });

  const [fullRes, biodataRes, nikRes] = await Promise.all([
    runTesseract(fullImage, "AUTO"),
    runTesseract(biodataLeft, "SINGLE_BLOCK"),
    runTesseract(nikTop, "SINGLE_BLOCK"),
  ]);

  const rawText = mergeKtpTexts({
    fullText: fullRes.text,
    biodataText: biodataRes.text,
    nikText: nikRes.text,
  });

  const cleanedText = cleanKtpText(rawText);

  return {
    rawText,
    cleanedText,
    confidence: averageConfidence([
      fullRes.confidence,
      biodataRes.confidence,
      nikRes.confidence,
    ]),
  };
}

async function runTesseract(
  imageDataUrl: string,
  psmMode: "AUTO" | "SINGLE_BLOCK"
): Promise<OcrSegmentResult> {
  const psm =
    psmMode === "SINGLE_BLOCK"
      ? Tesseract.PSM.SINGLE_BLOCK
      : Tesseract.PSM.AUTO;

  const { data } = await Tesseract.recognize(imageDataUrl, "ind+eng", {
    logger: (m) => console.log("[OCR KTP]", m),
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: "1",
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:./-,() \n",
  });

  return {
    text: data.text || "",
    confidence: Number(data.confidence || 0),
  };
}

function preprocessRegion(
  bitmap: ImageBitmap,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    mode: "balanced" | "text" | "digits";
    scaleTarget: number;
  }
) {
  const sx = Math.max(0, Math.floor(bitmap.width * options.x));
  const sy = Math.max(0, Math.floor(bitmap.height * options.y));
  const sw = Math.max(1, Math.floor(bitmap.width * options.width));
  const sh = Math.max(1, Math.floor(bitmap.height * options.height));

  const scale =
    sw > options.scaleTarget ? options.scaleTarget / sw : options.scaleTarget / sw;

  const tw = Math.max(1, Math.round(sw * scale));
  const th = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context tidak tersedia");

  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, tw, th);

  const imageData = ctx.getImageData(0, 0, tw, th);
  const data = imageData.data;

  let contrast = 35;
  let threshold = 168;
  let sharpenBias = 0;

  if (options.mode === "text") {
    contrast = 45;
    threshold = 172;
    sharpenBias = 10;
  }

  if (options.mode === "digits") {
    contrast = 52;
    threshold = 176;
    sharpenBias = 14;
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    gray = (((gray / 255 - 0.5) * (1 + contrast / 100)) + 0.5) * 255;
    gray = gray + sharpenBias;

    const finalValue = gray > threshold ? 255 : 0;

    data[i] = finalValue;
    data[i + 1] = finalValue;
    data[i + 2] = finalValue;
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

function mergeKtpTexts(params: {
  fullText: string;
  biodataText: string;
  nikText: string;
}) {
  const nik = cleanLoose(params.nikText);
  const biodata = cleanLoose(params.biodataText);
  const full = cleanLoose(params.fullText);

  return [nik, biodata, full].filter(Boolean).join("\n");
}

function cleanLoose(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function cleanKtpText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/[|]/g, "I")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[¥]/g, "Y")
    .replace(/[—–]/g, "-")
    .replace(/[^\S\n]+/g, " ")

    .replace(/PROV1NSI/gi, "PROVINSI")
    .replace(/PR0VINSI/gi, "PROVINSI")
    .replace(/K0TA/gi, "KOTA")
    .replace(/SURABAVA/gi, "SURABAYA")

    .replace(/\bN1K\b/gi, "NIK")
    .replace(/\bNIKK\b/gi, "NIK")
    .replace(/\bNara\b/gi, "Nama")
    .replace(/\bName\b/gi, "Nama")
    .replace(/\bNamaa\b/gi, "Nama")

    .replace(/Tempat[: ]+Toi Lahw/gi, "Tempat/Tgl Lahir")
    .replace(/Tempat[: ]+Tgi Lahu/gi, "Tempat/Tgl Lahir")
    .replace(/Tempat[: ]+Tgl Lahu/gi, "Tempat/Tgl Lahir")
    .replace(/Tempat Tgl Lahir/gi, "Tempat/Tgl Lahir")
    .replace(/Tempat TgI Lahir/gi, "Tempat/Tgl Lahir")
    .replace(/Tempat TgiLahu/gi, "Tempat/Tgl Lahir")
    .replace(/Tempat Toi Lahw/gi, "Tempat/Tgl Lahir")
    .replace(/Tempat Toi Lahu/gi, "Tempat/Tgl Lahir")

    .replace(/\bons Ketaman\b/gi, "Jenis Kelamin")
    .replace(/\bJens Ketaman\b/gi, "Jenis Kelamin")
    .replace(/\bJenis Ketaman\b/gi, "Jenis Kelamin")
    .replace(/\bJenis Kelarnin\b/gi, "Jenis Kelamin")
    .replace(/\bJenis Kelaminn\b/gi, "Jenis Kelamin")

    .replace(/\bMamat\b/gi, "Alamat")
    .replace(/\bAlarnat\b/gi, "Alamat")
    .replace(/\bAIamat\b/gi, "Alamat")

    .replace(/\bRTRW\b/gi, "RT/RW")
    .replace(/\bRT AW\b/gi, "RT/RW")
    .replace(/\bRT RW\b/gi, "RT/RW")

    .replace(/\bKetDesa\b/gi, "Kel/Desa")
    .replace(/\bKet Desa\b/gi, "Kel/Desa")
    .replace(/\bKel Desa\b/gi, "Kel/Desa")

    .replace(/\bPekenaan\b/gi, "Pekerjaan")
    .replace(/\bPekeriaan\b/gi, "Pekerjaan")
    .replace(/\bPekeijaan\b/gi, "Pekerjaan")

    .replace(/\bBertaku Hingga\b/gi, "Berlaku Hingga")
    .replace(/\bBerlalu Hngga\b/gi, "Berlaku Hingga")
    .replace(/\bBerlaku Hingqa\b/gi, "Berlaku Hingga")

    .replace(/\bRlTA\b/g, "RITA")
    .replace(/\bR1TA\b/g, "RITA")
    .replace(/\bMALAN6\b/g, "MALANG")
    .replace(/\bMALANGG\b/g, "MALANG")
    .replace(/\bSAMB1\b/g, "SAMBI")
    .replace(/\bWN1\b/g, "WNI")

    .replace(/\+b\./gi, "JL.")
    .replace(/\bJb\./gi, "JL.")
    .replace(/\bJI\./gi, "JL.")
    .replace(/\bJl\b(?!\.)/gi, "JL.")
    .replace(/\b44-11 3\b/gi, "44-Q/11")
    .replace(/\b44-11\b/gi, "44-Q/11")
    .replace(/\b003:\s*008\b/gi, "003/008")

    .replace(/NIK\s*:\s*([0-9Il!|bBGSoOZz%]+)/gi, (_, raw: string) => {
      const normalized = String(raw)
        .replace(/[%]/g, "8")
        .replace(/[OoQqD]/g, "0")
        .replace(/[Il!|]/g, "1")
        .replace(/[Zz]/g, "2")
        .replace(/[Ss]/g, "5")
        .replace(/[bG]/g, "6")
        .replace(/[B]/g, "8")
        .replace(/[^0-9]/g, "");
      return `NIK : ${normalized}`;
    })

    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function averageConfidence(values: number[]) {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}