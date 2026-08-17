from enum import Enum


class MessagingLogEntryChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"

    def __str__(self) -> str:
        return str(self.value)
