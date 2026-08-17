from enum import Enum


class ListMemberDeliveryStatus(str, Enum):
    BOUNCED = "bounced"
    COMPLAINED = "complained"
    OK = "ok"
    SUPPRESSED = "suppressed"

    def __str__(self) -> str:
        return str(self.value)
