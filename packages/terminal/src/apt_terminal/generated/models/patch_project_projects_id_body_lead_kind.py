from enum import Enum


class PatchProjectProjectsIdBodyLeadKind(str, Enum):
    CUSTOMER = "customer"
    PERSONA = "persona"
    TEAM = "team"

    def __str__(self) -> str:
        return str(self.value)
