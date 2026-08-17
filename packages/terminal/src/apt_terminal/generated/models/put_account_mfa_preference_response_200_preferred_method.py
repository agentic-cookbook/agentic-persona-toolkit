from enum import Enum


class PutAccountMfaPreferenceResponse200PreferredMethod(str, Enum):
    SMS = "sms"
    TOTP = "totp"
    WEBAUTHN = "webauthn"

    def __str__(self) -> str:
        return str(self.value)
