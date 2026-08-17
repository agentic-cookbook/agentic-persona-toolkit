from enum import Enum


class PostRegistryRegistriesRegistryIdEntriesEntryIdServicesBodyDeliveryMode(str, Enum):
    HYBRID = "hybrid"
    IN_PERSON = "in_person"
    VIRTUAL = "virtual"

    def __str__(self) -> str:
        return str(self.value)
