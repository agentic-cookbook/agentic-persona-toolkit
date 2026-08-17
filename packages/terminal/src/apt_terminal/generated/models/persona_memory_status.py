from enum import Enum


class PersonaMemoryStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    SUPERSEDED = "superseded"

    def __str__(self) -> str:
        return str(self.value)
