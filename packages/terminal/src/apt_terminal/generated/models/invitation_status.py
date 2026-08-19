from enum import Enum


class InvitationStatus(str, Enum):
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    REGISTERED = "registered"
    REVOKED = "revoked"
    SENT = "sent"

    def __str__(self) -> str:
        return str(self.value)
