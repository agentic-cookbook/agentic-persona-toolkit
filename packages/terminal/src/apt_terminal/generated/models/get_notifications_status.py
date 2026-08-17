from enum import Enum


class GetNotificationsStatus(str, Enum):
    ARCHIVED = "archived"
    INBOX = "inbox"
    TRASHED = "trashed"

    def __str__(self) -> str:
        return str(self.value)
