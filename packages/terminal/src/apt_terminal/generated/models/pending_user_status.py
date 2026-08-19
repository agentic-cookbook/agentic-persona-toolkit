from enum import Enum


class PendingUserStatus(str, Enum):
    ACCEPTED = "accepted"
    DECLINED = "declined"
    INVITED = "invited"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
