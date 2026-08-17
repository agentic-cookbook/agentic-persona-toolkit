from enum import Enum


class PutAccountMfaPreferenceBodyMethod(str, Enum):
    SMS = "sms"
    TOTP = "totp"
    WEBAUTHN = "webauthn"

    def __str__(self) -> str:
        return str(self.value)
