from enum import Enum


class PostRegistryRegistriesRegistryIdEntriesBodyVisibility(str, Enum):
    HUB = "hub"
    PRIVATE = "private"
    PUBLIC = "public"

    def __str__(self) -> str:
        return str(self.value)
