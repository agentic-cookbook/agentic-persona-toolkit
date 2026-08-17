from enum import Enum


class GetAccountMfaResponse200PreferredMethodType2Type1(str, Enum):
    SMS = "sms"
    TOTP = "totp"
    WEBAUTHN = "webauthn"

    def __str__(self) -> str:
        return str(self.value)
