from enum import Enum


class PersonaBootstrapAuthTokenClass(str, Enum):
    PERSONA = "persona"
    VISITOR = "visitor"

    def __str__(self) -> str:
        return str(self.value)
