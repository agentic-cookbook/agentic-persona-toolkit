from enum import Enum


class PublicPersonaVisibility(str, Enum):
    HUB = "hub"
    PUBLIC = "public"

    def __str__(self) -> str:
        return str(self.value)
