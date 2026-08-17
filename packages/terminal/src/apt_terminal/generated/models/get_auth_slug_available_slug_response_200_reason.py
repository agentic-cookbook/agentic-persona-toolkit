from enum import Enum


class GetAuthSlugAvailableSlugResponse200Reason(str, Enum):
    FORMAT = "format"
    TAKEN = "taken"

    def __str__(self) -> str:
        return str(self.value)
