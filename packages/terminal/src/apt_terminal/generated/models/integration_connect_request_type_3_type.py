from enum import Enum


class IntegrationConnectRequestType3Type(str, Enum):
    PLAID_LINK = "plaid_link"

    def __str__(self) -> str:
        return str(self.value)
