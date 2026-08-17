from enum import Enum


class PutMeAppearanceBodyTextSize(str, Enum):
    DEFAULT = "default"
    EXTRA_LARGE = "extra-large"
    LARGE = "large"
    SMALL = "small"

    def __str__(self) -> str:
        return str(self.value)
