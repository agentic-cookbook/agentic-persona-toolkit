from enum import Enum


class AppearanceSettingsPrefsSpacing(str, Enum):
    COMFORTABLE = "comfortable"
    COMPACT = "compact"
    SPACIOUS = "spacious"

    def __str__(self) -> str:
        return str(self.value)
