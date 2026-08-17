from enum import Enum


class GamificationCatalogBadgeSource(str, Enum):
    DEFAULT = "default"
    REALM = "realm"

    def __str__(self) -> str:
        return str(self.value)
