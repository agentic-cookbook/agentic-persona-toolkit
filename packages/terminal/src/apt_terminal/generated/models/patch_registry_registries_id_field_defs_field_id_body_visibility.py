from enum import Enum


class PatchRegistryRegistriesIdFieldDefsFieldIdBodyVisibility(str, Enum):
    AUTHENTICATED = "authenticated"
    PRIVATE = "private"
    PUBLIC = "public"

    def __str__(self) -> str:
        return str(self.value)
