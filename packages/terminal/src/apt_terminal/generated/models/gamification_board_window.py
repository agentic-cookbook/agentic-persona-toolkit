from enum import Enum


class GamificationBoardWindow(str, Enum):
    ALLTIME = "allTime"
    ROLLING30 = "rolling30"
    SEASON = "season"
    TRENDING = "trending"

    def __str__(self) -> str:
        return str(self.value)
