from enum import Enum


class PostPersonaMemoryGlobalBodyMemoryType(str, Enum):
    FEEDBACK = "feedback"
    PROJECT = "project"
    REFERENCE = "reference"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
