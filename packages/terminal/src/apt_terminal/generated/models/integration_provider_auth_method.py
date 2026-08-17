from enum import Enum


class IntegrationProviderAuthMethod(str, Enum):
    API_KEY = "api_key"
    APP_PASSWORD = "app_password"
    OAUTH = "oauth"
    OAUTH_INSTANCE = "oauth_instance"
    PLAID_LINK = "plaid_link"

    def __str__(self) -> str:
        return str(self.value)
