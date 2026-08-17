from enum import Enum


class IntegrationConnectRequestType4Type(str, Enum):
    OAUTH_INSTANCE = "oauth_instance"

    def __str__(self) -> str:
        return str(self.value)
