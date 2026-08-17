from enum import Enum


class PublicRegistryEntryDetailProviderType(str, Enum):
    ORGANIZATION = "organization"
    PERSON = "person"
    PERSONA = "persona"

    def __str__(self) -> str:
        return str(self.value)
