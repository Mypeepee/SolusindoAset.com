from typing import List
from pydantic import BaseModel, Field


class KwitansiParsedSchema(BaseModel):
    nomor_kwitansi: str = ""
    nomor_risalah_lelang: str = ""
    tanggal_risalah: str = ""
    luas: str = ""
    alamat_desa: str = ""
    alamat_kecamatan: str = ""
    alamat_kota: str = ""
    alamat_provinsi: str = ""
    no_sertifikat: str = ""
    tanggal_kwitansi: str = ""
    nama_bank: str = ""


class KwitansiOcrResponseSchema(BaseModel):
    raw_text: str = ""
    cleaned_text: str = ""
    confidence: float = 0
    parsed: KwitansiParsedSchema = Field(default_factory=KwitansiParsedSchema)
    score: float = 0
    status: str = "invalid"
    warnings: List[str] = Field(default_factory=list)
