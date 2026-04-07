import os
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas.ktp import KtpOcrResponseSchema
from app.services.ktp_ocr import detect_text_google_vision, clean_ocr_text
from app.services.ktp_parser import parse_ktp_text
from app.services.ktp_preprocess import preprocess_ktp_image

load_dotenv()

app = FastAPI(title="OCR KTP API")

origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.post("/api/ocr/ktp", response_model=KtpOcrResponseSchema)
async def ocr_ktp(file: UploadFile = File(...)):
    try:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File harus berupa gambar.")

        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="File kosong.")

        processed_bytes = preprocess_ktp_image(file_bytes)

        ocr_result = detect_text_google_vision(processed_bytes)
        raw_text = ocr_result.get("raw_text", "")
        confidence = ocr_result.get("confidence", 0)

        cleaned_text = clean_ocr_text(raw_text)
        parsed_result = parse_ktp_text(cleaned_text)

        print("\n=== RAW TEXT ===")
        print(raw_text)
        print("\n=== CLEANED TEXT ===")
        print(cleaned_text)
        print("\n=== PARSED RESULT ===")
        print(parsed_result)
        print("====================\n")

        return {
            "raw_text": raw_text,
            "cleaned_text": cleaned_text,
            "confidence": confidence,
            "parsed": parsed_result["parsed"],
            "score": parsed_result["score"],
            "status": parsed_result["status"],
            "warnings": parsed_result["warnings"],
        }

    except HTTPException:
        raise
    except Exception as e:
        print("\n=== OCR ERROR ===")
        print(str(e))
        print("=================\n")
        raise HTTPException(status_code=500, detail=f"Gagal OCR KTP: {str(e)}")