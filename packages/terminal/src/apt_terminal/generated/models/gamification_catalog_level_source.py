from enum import Enum


class GamificationCatalogLevelSource(str, Enum):
    DEFAULT = "default"
    REALM = "realm"

    def __str__(self) -> str:
        return str(self.value)
