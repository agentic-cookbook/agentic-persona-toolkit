from enum import Enum


class UsageSummaryRowKind(str, Enum):
    APPLICATION = "application"
    ECOSYSTEM = "ecosystem"
    MEMBER = "member"
    PERSONA = "persona"
    SELF = "self"
    TOKEN = "token"

    def __str__(self) -> str:
        return str(self.value)
