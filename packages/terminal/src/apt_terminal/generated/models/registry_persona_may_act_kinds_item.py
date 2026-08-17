from enum import Enum


class RegistryPersonaMayActKindsItem(str, Enum):
    ORG = "org"
    SELF = "self"
    TEAM = "team"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
