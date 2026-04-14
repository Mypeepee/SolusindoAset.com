import io
import pdfplumber
import re


def extract_text_from_pdf(file_bytes: bytes) -> dict:
    """Extract text from PDF file."""
    try:
        pdf_file = io.BytesIO(file_bytes)
        raw_text = ""
        confidence = 100  # PDF text extraction has high confidence

        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    raw_text += page_text + "\n"

        # Calculate a basic confidence based on text extraction success
        if not raw_text.strip():
            confidence = 0
        else:
            # PDFs are more reliable than images, so higher confidence
            confidence = min(100, 95 + (len(raw_text.split()) // 100))

        return {
            "raw_text": raw_text,
            "confidence": confidence,
        }
    except Exception as e:
        raise Exception(f"Failed to extract text from PDF: {str(e)}")


def clean_ocr_text(text: str) -> str:
    """Clean extracted text."""
    text = text or ""
    text = text.replace("\t", " ")
    text = re.sub(r"[ ]{2,}", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()
