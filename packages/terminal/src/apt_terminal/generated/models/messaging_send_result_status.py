from enum import Enum


class MessagingSendResultStatus(str, Enum):
    FAILED = "failed"
    SENT = "sent"

    def __str__(self) -> str:
        return str(self.value)
