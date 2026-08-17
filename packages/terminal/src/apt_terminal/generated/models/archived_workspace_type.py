from enum import Enum


class ArchivedWorkspaceType(str, Enum):
    ORGANIZATION = "organization"

    def __str__(self) -> str:
        return str(self.value)
