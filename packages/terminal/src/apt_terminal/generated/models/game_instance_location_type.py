from enum import Enum


class GameInstanceLocationType(str, Enum):
    GAME = "game"
    INSTANCE = "instance"
    PLAYER = "player"
    SESSION = "session"

    def __str__(self) -> str:
        return str(self.value)
