from enum import Enum


class GetFriendsRequestsDirection(str, Enum):
    RECEIVED = "received"
    SENT = "sent"

    def __str__(self) -> str:
        return str(self.value)
