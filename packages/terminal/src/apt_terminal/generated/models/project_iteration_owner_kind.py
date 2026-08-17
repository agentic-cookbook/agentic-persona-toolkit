from enum import Enum


class ProjectIterationOwnerKind(str, Enum):
    CUSTOMER = "customer"
    ORGANIZATION = "organization"

    def __str__(self) -> str:
        return str(self.value)
