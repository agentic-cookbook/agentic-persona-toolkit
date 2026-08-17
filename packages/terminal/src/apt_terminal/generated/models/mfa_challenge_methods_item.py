from enum import Enum


class MfaChallengeMethodsItem(str, Enum):
    RECOVERY = "recovery"
    SMS = "sms"
    TOTP = "totp"
    WEBAUTHN = "webauthn"

    def __str__(self) -> str:
        return str(self.value)
