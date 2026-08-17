from enum import Enum


class GamificationRealmBadgeTierType3Type1(str, Enum):
    BRONZE = "bronze"
    GOLD = "gold"
    NONE = "none"
    PLATINUM = "platinum"
    SILVER = "silver"

    def __str__(self) -> str:
        return str(self.value)
