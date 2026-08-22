from enum import Enum


class GetContentMarkdownIdRouteAvailableRouteResponse200Reason(str, Enum):
    INVALID = "invalid"
    OK = "ok"
    RESERVED = "reserved"
    TAKEN = "taken"

    def __str__(self) -> str:
        return str(self.value)
