from enum import Enum


class ProviderConnectionSpecType0AuthType(str, Enum):
    BEARER = "bearer"
    HEADER = "header"
    OAUTH2 = "oauth2"
    SIGV4 = "sigv4"

    def __str__(self) -> str:
        return str(self.value)
