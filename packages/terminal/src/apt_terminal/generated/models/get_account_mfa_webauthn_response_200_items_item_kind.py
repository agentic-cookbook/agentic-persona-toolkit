from enum import Enum


class GetAccountMfaWebauthnResponse200ItemsItemKind(str, Enum):
    PASSKEY = "passkey"
    SECURITY_KEY = "security_key"

    def __str__(self) -> str:
        return str(self.value)
