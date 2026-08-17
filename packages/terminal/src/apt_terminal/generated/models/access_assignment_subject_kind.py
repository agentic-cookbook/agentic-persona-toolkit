from enum import Enum


class AccessAssignmentSubjectKind(str, Enum):
    CUSTOMER = "customer"
    PERSONA = "persona"
    TEAM = "team"

    def __str__(self) -> str:
        return str(self.value)
