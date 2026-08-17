from enum import Enum


class PostOwnershipTransferResponse200RevokedSubjectsItemKind(str, Enum):
    APP = "app"
    ORGANIZATION = "organization"
    PERSONA = "persona"
    TEAM = "team"
    TOKEN = "token"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
