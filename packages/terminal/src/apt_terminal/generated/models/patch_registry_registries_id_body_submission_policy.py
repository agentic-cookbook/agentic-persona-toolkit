from enum import Enum


class PatchRegistryRegistriesIdBodySubmissionPolicy(str, Enum):
    OPEN = "open"
    REVIEWED = "reviewed"

    def __str__(self) -> str:
        return str(self.value)
