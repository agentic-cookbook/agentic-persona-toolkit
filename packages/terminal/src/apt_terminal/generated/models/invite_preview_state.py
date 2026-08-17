from enum import Enum


class InvitePreviewState(str, Enum):
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    INVALID = "invalid"
    VALID = "valid"

    def __str__(self) -> str:
        return str(self.value)
