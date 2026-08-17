from enum import Enum


class PersonaMemoryMatchScope(str, Enum):
    PERSONA = "persona"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
