from enum import Enum


class WorkItemRelationDirection(str, Enum):
    INCOMING = "incoming"
    OUTGOING = "outgoing"

    def __str__(self) -> str:
        return str(self.value)
