from enum import Enum


class SyncEnrollmentRowScope(str, Enum):
    CUSTOMER = "customer"
    ECOSYSTEM = "ecosystem"

    def __str__(self) -> str:
        return str(self.value)
