from enum import Enum


class PostProjectProjectsIdParticipantsBodyParticipantKind(str, Enum):
    CUSTOMER = "customer"
    PERSONA = "persona"
    TEAM = "team"

    def __str__(self) -> str:
        return str(self.value)
