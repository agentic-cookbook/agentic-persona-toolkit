from enum import Enum


class SyncChangeOp(str, Enum):
    DELETE = "delete"
    UPSERT = "upsert"

    def __str__(self) -> str:
        return str(self.value)
