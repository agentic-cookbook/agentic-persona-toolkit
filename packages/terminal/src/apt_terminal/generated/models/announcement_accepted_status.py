from enum import Enum


class AnnouncementAcceptedStatus(str, Enum):
    SENDING = "sending"

    def __str__(self) -> str:
        return str(self.value)
