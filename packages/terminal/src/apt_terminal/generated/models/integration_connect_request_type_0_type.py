from enum import Enum


class IntegrationConnectRequestType0Type(str, Enum):
    OAUTH = "oauth"

    def __str__(self) -> str:
        return str(self.value)
