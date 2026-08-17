from enum import Enum


class SyncPushOpType(str, Enum):
    DELETE = "delete"
    UPSERT = "upsert"

    def __str__(self) -> str:
        return str(self.value)
