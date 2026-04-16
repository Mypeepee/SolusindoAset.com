"""
Hybrid PDF OCR for Risalah Lelang.

Strategy:
  1. Try pdfplumber text extraction (fast, perfect for digital PDFs).
  2. If extracted text is too short (< MIN_CHARS), the PDF is image-based
     (e.g. scanned with CamScanner).  Fall back to:
       - Render each page as a PNG via PyMuPDF (fitz) — no external deps needed.
       - Run Google Vision OCR on the rendered image.
"""

import io
import re

import pdfplumber

MIN_CHARS = 80  # below this → treat as image-based PDF


def _clean(text: str) -> str:
    text = text or ""
    text = text.replace("\t", " ")
    text = re.sub(r"[ ]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Strategy 1: pdfplumber (digital PDFs) ─────────────────────────────────────

def _extract_via_pdfplumber(file_bytes: bytes) -> str:
    pdf_file = io.BytesIO(file_bytes)
    pages = []
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                pages.append(t)
    return "\n".join(pages)


# ── Strategy 2: PyMuPDF render → Google Vision (scanned PDFs) ─────────────────

def _render_pages_as_png(file_bytes: bytes, dpi: int = 200) -> list[bytes]:
    """Return a list of PNG bytes, one per page."""
    import fitz  # pymupdf — only imported when needed

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    images = []
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    for page in doc:
        pix = page.get_pixmap(matrix=mat, alpha=False)
        images.append(pix.tobytes("png"))
    doc.close()
    return images


def _ocr_image_bytes(png_bytes: bytes) -> tuple[str, float]:
    """Run Google Vision on a single PNG, return (raw_text, confidence)."""
    from app.services.ktp_ocr import detect_text_google_vision
    from app.services.ktp_preprocess import preprocess_ktp_image

    # Mild preprocessing (contrast / grayscale) helps even on coloured paper
    processed = preprocess_ktp_image(png_bytes)
    result = detect_text_google_vision(processed)
    return result.get("raw_text", ""), result.get("confidence", 0.0)


def _extract_via_vision(file_bytes: bytes) -> tuple[str, float]:
    """Render every page and OCR it; combine results."""
    pages_png = _render_pages_as_png(file_bytes)
    texts: list[str] = []
    confidences: list[float] = []
    for png in pages_png:
        text, conf = _ocr_image_bytes(png)
        if text:
            texts.append(text)
            confidences.append(conf)
    combined = "\n".join(texts)
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return combined, avg_conf


# ── Public API ─────────────────────────────────────────────────────────────────

def extract_risalah_text(file_bytes: bytes) -> dict:
    """
    Returns {"raw_text": str, "confidence": float, "method": str}
    """
    # --- try pdfplumber first ---
    try:
        raw = _extract_via_pdfplumber(file_bytes)
        cleaned = _clean(raw)
        if len(cleaned) >= MIN_CHARS:
            return {
                "raw_text": cleaned,
                "confidence": 97.0,
                "method": "pdfplumber",
            }
    except Exception as e:
        print(f"[risalah_ocr] pdfplumber failed: {e}")

    # --- fall back to Google Vision ---
    print("[risalah_ocr] pdfplumber yielded insufficient text — falling back to Vision OCR")
    try:
        raw, confidence = _extract_via_vision(file_bytes)
        cleaned = _clean(raw)
        return {
            "raw_text": cleaned,
            "confidence": confidence,
            "method": "vision",
        }
    except Exception as e:
        raise Exception(f"Kedua metode OCR gagal: {str(e)}")
