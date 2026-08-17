from enum import Enum


class PersonaMemoryMatchMemoryType(str, Enum):
    FEEDBACK = "feedback"
    PROJECT = "project"
    REFERENCE = "reference"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
