from enum import Enum


class AppearanceSettingsPrefsContrast(str, Enum):
    DEFAULT = "default"
    EXTRA_HIGH = "extra-high"
    HIGH = "high"

    def __str__(self) -> str:
        return str(self.value)
