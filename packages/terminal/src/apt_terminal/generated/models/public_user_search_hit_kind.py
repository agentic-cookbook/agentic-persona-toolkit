from enum import Enum


class PublicUserSearchHitKind(str, Enum):
    ORGANIZATION = "organization"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
