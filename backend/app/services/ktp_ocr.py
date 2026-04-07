import re
from google.cloud import vision


def detect_text_google_vision(file_bytes: bytes) -> dict:
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=file_bytes)

    response = client.document_text_detection(image=image)

    if response.error.message:
        raise Exception(response.error.message)

    raw_text = ""
    confidence_values = []

    if response.full_text_annotation:
        raw_text = response.full_text_annotation.text or ""

        for page in response.full_text_annotation.pages:
            for block in page.blocks:
                confidence_values.append(block.confidence or 0)

    confidence = (
        round((sum(confidence_values) / len(confidence_values)) * 100, 2)
        if confidence_values
        else 0
    )

    return {
        "raw_text": raw_text,
        "confidence": confidence,
    }


def clean_ocr_text(text: str) -> str:
    text = text or ""
    text = text.replace("\t", " ")
    text = re.sub(r"[ ]{2,}", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()