from enum import Enum


class TeamMemberMemberKind(str, Enum):
    CUSTOMER = "customer"
    PERSONA = "persona"

    def __str__(self) -> str:
        return str(self.value)
