from typing import List
from pydantic import BaseModel, Field


class KtpParsedSchema(BaseModel):
    nama_pemohon: str = ""
    nik_pemohon: str = ""
    kotalahir_pemohon: str = ""
    tanggallahir_pemohon: str = ""
    kelamin_pemohon: str = ""
    agama_pemohon: str = ""
    alamat_pemohon: str = ""
    pekerjaan_pemohon: str = ""
    statuskawin_pemohon: str = ""
    warga_negara: str = "Indonesia"


class KtpOcrResponseSchema(BaseModel):
    raw_text: str = ""
    cleaned_text: str = ""
    confidence: float = 0
    parsed: KtpParsedSchema = Field(default_factory=KtpParsedSchema)
    score: float = 0
    status: str = "invalid"
    warnings: List[str] = Field(default_factory=list)