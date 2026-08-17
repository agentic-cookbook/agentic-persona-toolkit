from enum import Enum


class PostOwnershipTransferResponse200RevokedSubjectsItemVia(str, Enum):
    DIRECT = "direct"
    GROUP = "group"
    PARTICIPANT = "participant"
    ROLE = "role"
    TEAM = "team"

    def __str__(self) -> str:
        return str(self.value)
