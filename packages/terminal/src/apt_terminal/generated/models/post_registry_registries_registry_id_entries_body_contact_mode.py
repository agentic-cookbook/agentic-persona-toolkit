from enum import Enum


class PostRegistryRegistriesRegistryIdEntriesBodyContactMode(str, Enum):
    DM = "dm"
    NONE = "none"

    def __str__(self) -> str:
        return str(self.value)
