from enum import Enum


class PutMeAppearanceBodyReduceMotion(str, Enum):
    AUTO = "auto"
    OFF = "off"
    ON = "on"

    def __str__(self) -> str:
        return str(self.value)
