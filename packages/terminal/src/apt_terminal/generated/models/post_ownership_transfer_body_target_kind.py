from enum import Enum


class PostOwnershipTransferBodyTargetKind(str, Enum):
    CUSTOMER = "customer"
    ORGANIZATION = "organization"

    def __str__(self) -> str:
        return str(self.value)
