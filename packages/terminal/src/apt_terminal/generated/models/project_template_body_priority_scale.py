from enum import Enum


class ProjectTemplateBodyPriorityScale(str, Enum):
    NONE = "none"
    STANDARD = "standard"

    def __str__(self) -> str:
        return str(self.value)
