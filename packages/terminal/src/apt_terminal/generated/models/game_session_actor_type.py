from enum import Enum


class GameSessionActorType(str, Enum):
    USER = "user"
    VISITOR = "visitor"

    def __str__(self) -> str:
        return str(self.value)
