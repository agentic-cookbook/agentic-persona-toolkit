from enum import Enum


class GetOwnershipTransferPreviewResponse200RevokingItemKind(str, Enum):
    APP = "app"
    ORGANIZATION = "organization"
    PERSONA = "persona"
    TEAM = "team"
    TOKEN = "token"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
