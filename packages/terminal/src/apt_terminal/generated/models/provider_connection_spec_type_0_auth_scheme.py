from enum import Enum


class ProviderConnectionSpecType0AuthScheme(str, Enum):
    BEARER = "bearer"
    RAW = "raw"

    def __str__(self) -> str:
        return str(self.value)
