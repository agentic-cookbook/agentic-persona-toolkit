from enum import Enum


class IntegrationConnectOAuthType(str, Enum):
    OAUTH = "oauth"

    def __str__(self) -> str:
        return str(self.value)
