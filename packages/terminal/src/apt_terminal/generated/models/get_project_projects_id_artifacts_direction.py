from enum import Enum


class GetProjectProjectsIdArtifactsDirection(str, Enum):
    INGESTED = "ingested"
    PRODUCED = "produced"

    def __str__(self) -> str:
        return str(self.value)
