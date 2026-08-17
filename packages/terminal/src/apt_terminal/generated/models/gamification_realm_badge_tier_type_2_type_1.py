from enum import Enum


class GamificationRealmBadgeTierType2Type1(str, Enum):
    BRONZE = "bronze"
    GOLD = "gold"
    NONE = "none"
    PLATINUM = "platinum"
    SILVER = "silver"

    def __str__(self) -> str:
        return str(self.value)
