from enum import Enum


class GameSessionStatus(str, Enum):
    ABANDONED = "abandoned"
    ACTIVE = "active"
    ENDED = "ended"

    def __str__(self) -> str:
        return str(self.value)
