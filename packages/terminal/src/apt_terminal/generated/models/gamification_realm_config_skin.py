from enum import Enum


class GamificationRealmConfigSkin(str, Enum):
    PLAIN = "plain"
    RPG = "rpg"

    def __str__(self) -> str:
        return str(self.value)
