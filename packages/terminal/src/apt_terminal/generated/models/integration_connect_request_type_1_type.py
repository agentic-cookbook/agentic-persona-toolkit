from enum import Enum


class IntegrationConnectRequestType1Type(str, Enum):
    API_KEY = "api_key"

    def __str__(self) -> str:
        return str(self.value)
