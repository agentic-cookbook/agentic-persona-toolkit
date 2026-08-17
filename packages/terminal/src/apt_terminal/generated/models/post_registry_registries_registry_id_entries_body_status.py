from enum import Enum


class PostRegistryRegistriesRegistryIdEntriesBodyStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    PUBLISHED = "published"

    def __str__(self) -> str:
        return str(self.value)
