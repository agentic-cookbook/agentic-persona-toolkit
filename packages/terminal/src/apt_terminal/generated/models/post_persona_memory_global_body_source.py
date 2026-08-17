from enum import Enum


class PostPersonaMemoryGlobalBodySource(str, Enum):
    INFERRED = "inferred"
    TOOL = "tool"
    USER_STATED = "user_stated"

    def __str__(self) -> str:
        return str(self.value)
