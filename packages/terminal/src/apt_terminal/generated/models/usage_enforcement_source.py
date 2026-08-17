from enum import Enum


class UsageEnforcementSource(str, Enum):
    ENVIRONMENT = "environment"
    FLAG = "flag"

    def __str__(self) -> str:
        return str(self.value)
