from enum import Enum


class WorkspaceType(str, Enum):
    INDIVIDUAL = "individual"
    ORGANIZATION = "organization"
    TEAM = "team"

    def __str__(self) -> str:
        return str(self.value)
