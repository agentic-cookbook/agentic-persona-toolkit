from enum import Enum


class MessagingLogEntryOrigin(str, Enum):
    ECOSYSTEM = "ecosystem"
    PLATFORM = "platform"

    def __str__(self) -> str:
        return str(self.value)
