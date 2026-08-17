from enum import Enum


class CatalogSyncOutcomeSource(str, Enum):
    ARENA = "arena"
    MODELSDEV = "modelsDev"
    OPENROUTER = "openrouter"

    def __str__(self) -> str:
        return str(self.value)
