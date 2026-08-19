from enum import Enum


class PatchRegistryRegistriesRegistryIdEntriesEntryIdBodyVisibility(str, Enum):
    HUB = "hub"
    PRIVATE = "private"
    PUBLIC = "public"

    def __str__(self) -> str:
        return str(self.value)
