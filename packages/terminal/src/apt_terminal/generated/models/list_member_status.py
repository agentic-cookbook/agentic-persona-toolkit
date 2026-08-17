from enum import Enum


class ListMemberStatus(str, Enum):
    SUBSCRIBED = "subscribed"
    UNSUBSCRIBED = "unsubscribed"

    def __str__(self) -> str:
        return str(self.value)
