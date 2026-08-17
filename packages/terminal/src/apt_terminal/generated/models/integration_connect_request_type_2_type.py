from enum import Enum


class IntegrationConnectRequestType2Type(str, Enum):
    APP_PASSWORD = "app_password"

    def __str__(self) -> str:
        return str(self.value)
