from enum import Enum


class VisitorStatusEventPhase(str, Enum):
    RETRYING = "retrying"

    def __str__(self) -> str:
        return str(self.value)
