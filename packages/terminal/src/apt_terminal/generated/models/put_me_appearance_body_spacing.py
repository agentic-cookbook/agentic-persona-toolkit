from enum import Enum


class PutMeAppearanceBodySpacing(str, Enum):
    COMFORTABLE = "comfortable"
    COMPACT = "compact"
    SPACIOUS = "spacious"

    def __str__(self) -> str:
        return str(self.value)
