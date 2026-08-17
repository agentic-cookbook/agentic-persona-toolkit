from enum import Enum


class PublicRegistryFieldVisibility(str, Enum):
    AUTHENTICATED = "authenticated"
    PUBLIC = "public"

    def __str__(self) -> str:
        return str(self.value)
