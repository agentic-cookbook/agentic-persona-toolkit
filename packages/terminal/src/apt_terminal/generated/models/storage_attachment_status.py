from enum import Enum


class StorageAttachmentStatus(str, Enum):
    PENDING = "pending"
    READY = "ready"

    def __str__(self) -> str:
        return str(self.value)
