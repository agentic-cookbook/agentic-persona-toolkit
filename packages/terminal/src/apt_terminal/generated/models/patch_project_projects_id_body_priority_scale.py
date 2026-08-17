from enum import Enum


class PatchProjectProjectsIdBodyPriorityScale(str, Enum):
    NONE = "none"
    STANDARD = "standard"

    def __str__(self) -> str:
        return str(self.value)
