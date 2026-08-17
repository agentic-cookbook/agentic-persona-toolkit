from enum import Enum


class ProjectIterationState(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    UPCOMING = "upcoming"

    def __str__(self) -> str:
        return str(self.value)
