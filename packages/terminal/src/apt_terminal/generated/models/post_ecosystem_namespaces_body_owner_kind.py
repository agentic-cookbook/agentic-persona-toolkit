from enum import Enum


class PostEcosystemNamespacesBodyOwnerKind(str, Enum):
    CUSTOMER = "customer"
    ECOSYSTEM = "ecosystem"
    ORGANIZATION = "organization"
    PERSONA = "persona"

    def __str__(self) -> str:
        return str(self.value)
