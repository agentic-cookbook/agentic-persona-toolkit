from enum import Enum


class PublicPersonaSummaryVisibility(str, Enum):
    HUB = "hub"
    PUBLIC = "public"

    def __str__(self) -> str:
        return str(self.value)
