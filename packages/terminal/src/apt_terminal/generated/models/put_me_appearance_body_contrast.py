from enum import Enum


class PutMeAppearanceBodyContrast(str, Enum):
    DEFAULT = "default"
    EXTRA_HIGH = "extra-high"
    HIGH = "high"

    def __str__(self) -> str:
        return str(self.value)
