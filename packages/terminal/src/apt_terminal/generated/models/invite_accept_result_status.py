from enum import Enum


class InviteAcceptResultStatus(str, Enum):
    ACCEPTED = "accepted"
    VERIFICATION_REQUIRED = "verification_required"

    def __str__(self) -> str:
        return str(self.value)
