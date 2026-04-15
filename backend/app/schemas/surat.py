from pydantic import BaseModel
from typing import Dict


class GenerateSuratRequest(BaseModel):
    template_file: str
    values: Dict[str, str]
