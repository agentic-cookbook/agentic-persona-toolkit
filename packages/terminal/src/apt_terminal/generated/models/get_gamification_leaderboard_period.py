from enum import Enum


class GetGamificationLeaderboardPeriod(str, Enum):
    ALL = "all"
    MONTH = "month"
    WEEK = "week"

    def __str__(self) -> str:
        return str(self.value)
