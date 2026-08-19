from enum import Enum


class IntegrationConnectPlaidLinkType(str, Enum):
    PLAID_LINK = "plaid_link"

    def __str__(self) -> str:
        return str(self.value)
