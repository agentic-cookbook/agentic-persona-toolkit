from enum import Enum


class PublicPersonaVisibility(str, Enum):
    PUBLIC = "public"
    UNLISTED = "unlisted"

    def __str__(self) -> str:
        return str(self.value)
