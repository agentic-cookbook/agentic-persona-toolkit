from enum import Enum


class PersonaMemoryScope(str, Enum):
    PERSONA = "persona"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
