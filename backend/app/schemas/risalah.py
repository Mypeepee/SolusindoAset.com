from typing import List
from pydantic import BaseModel, Field


class RisalahParsedSchema(BaseModel):
    nomor_risalah: str = ""
    tanggal_risalah: str = ""
    uraian: str = ""


class RisalahOcrResponseSchema(BaseModel):
    raw_text: str = ""
    cleaned_text: str = ""
    confidence: float = 0
    parsed: RisalahParsedSchema = Field(default_factory=RisalahParsedSchema)
    score: float = 0
    status: str = "invalid"
    warnings: List[str] = Field(default_factory=list)