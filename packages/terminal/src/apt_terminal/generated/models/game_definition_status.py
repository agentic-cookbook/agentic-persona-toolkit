from enum import Enum


class GameDefinitionStatus(str, Enum):
    ACTIVE = "active"
    RETIRED = "retired"

    def __str__(self) -> str:
        return str(self.value)
