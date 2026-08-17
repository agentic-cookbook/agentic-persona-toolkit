from enum import Enum


class PostIntegrationsEcosystemsEcosystemIdProviderConfigsBodyCredentialStyle(str, Enum):
    BASIC_AUTH = "basic_auth"
    FORM_BODY = "form_body"

    def __str__(self) -> str:
        return str(self.value)
