from enum import Enum


class PostProjectTemplatesBodyKind(str, Enum):
    PROJECT = "project"
    WORK_ITEM = "work_item"

    def __str__(self) -> str:
        return str(self.value)
