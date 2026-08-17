from enum import Enum


class SyncPushResultStatus(str, Enum):
    APPLIED = "applied"
    CONFLICT = "conflict"
    REJECTED = "rejected"

    def __str__(self) -> str:
        return str(self.value)
