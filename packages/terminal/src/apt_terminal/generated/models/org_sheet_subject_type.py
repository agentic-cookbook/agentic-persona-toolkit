from enum import Enum


class OrgSheetSubjectType(str, Enum):
    ORG = "org"

    def __str__(self) -> str:
        return str(self.value)
