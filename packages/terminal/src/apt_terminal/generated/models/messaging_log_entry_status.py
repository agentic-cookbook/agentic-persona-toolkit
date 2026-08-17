from enum import Enum


class MessagingLogEntryStatus(str, Enum):
    FAILED = "failed"
    SENT = "sent"

    def __str__(self) -> str:
        return str(self.value)
