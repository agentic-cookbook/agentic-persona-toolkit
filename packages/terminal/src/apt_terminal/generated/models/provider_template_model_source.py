from enum import Enum


class ProviderTemplateModelSource(str, Enum):
    CURATED = "curated"
    SYNCED = "synced"

    def __str__(self) -> str:
        return str(self.value)
