from enum import Enum


class PostRegistryRegistriesBodySubmissionPolicy(str, Enum):
    OPEN = "open"
    REVIEWED = "reviewed"

    def __str__(self) -> str:
        return str(self.value)
