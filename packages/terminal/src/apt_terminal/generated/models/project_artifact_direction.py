from enum import Enum


class ProjectArtifactDirection(str, Enum):
    INGESTED = "ingested"
    PRODUCED = "produced"

    def __str__(self) -> str:
        return str(self.value)
