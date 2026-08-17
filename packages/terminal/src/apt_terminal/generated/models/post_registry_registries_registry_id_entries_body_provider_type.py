from enum import Enum


class PostRegistryRegistriesRegistryIdEntriesBodyProviderType(str, Enum):
    ORGANIZATION = "organization"
    PERSON = "person"
    PERSONA = "persona"

    def __str__(self) -> str:
        return str(self.value)
