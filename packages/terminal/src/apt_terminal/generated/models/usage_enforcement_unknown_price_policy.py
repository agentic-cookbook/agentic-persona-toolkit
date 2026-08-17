from enum import Enum


class UsageEnforcementUnknownPricePolicy(str, Enum):
    CEILING = "ceiling"
    FREE = "free"
    REFUSE = "refuse"

    def __str__(self) -> str:
        return str(self.value)
