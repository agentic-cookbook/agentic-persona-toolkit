from enum import Enum


class IntegrationConnectOAuthInstanceType(str, Enum):
    OAUTH_INSTANCE = "oauth_instance"

    def __str__(self) -> str:
        return str(self.value)
