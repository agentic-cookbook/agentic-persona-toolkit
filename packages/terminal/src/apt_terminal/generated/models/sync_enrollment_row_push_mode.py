from enum import Enum


class SyncEnrollmentRowPushMode(str, Enum):
    GENERIC = "generic"
    ROUTE = "route"

    def __str__(self) -> str:
        return str(self.value)
