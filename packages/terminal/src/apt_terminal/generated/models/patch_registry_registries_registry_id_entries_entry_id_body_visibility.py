from enum import Enum


class PatchRegistryRegistriesRegistryIdEntriesEntryIdBodyVisibility(str, Enum):
    PRIVATE = "private"
    PUBLIC = "public"
    UNLISTED = "unlisted"

    def __str__(self) -> str:
        return str(self.value)
