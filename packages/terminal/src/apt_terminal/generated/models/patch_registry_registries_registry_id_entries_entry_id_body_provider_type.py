from enum import Enum


class PatchRegistryRegistriesRegistryIdEntriesEntryIdBodyProviderType(str, Enum):
    ORGANIZATION = "organization"
    PERSON = "person"
    PERSONA = "persona"

    def __str__(self) -> str:
        return str(self.value)
