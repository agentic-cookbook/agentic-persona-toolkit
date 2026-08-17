from enum import Enum


class GetSystemFeatureFlagsScope(str, Enum):
    SYSTEM = "system"

    def __str__(self) -> str:
        return str(self.value)
