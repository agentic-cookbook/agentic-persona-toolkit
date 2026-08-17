from enum import Enum


class ProjectOwnerKind(str, Enum):
    CUSTOMER = "customer"
    ORGANIZATION = "organization"

    def __str__(self) -> str:
        return str(self.value)
