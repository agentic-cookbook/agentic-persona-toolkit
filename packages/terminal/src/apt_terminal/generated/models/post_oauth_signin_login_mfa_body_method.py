from enum import Enum


class PostOauthSigninLoginMfaBodyMethod(str, Enum):
    RECOVERY = "recovery"
    SMS = "sms"
    TOTP = "totp"

    def __str__(self) -> str:
        return str(self.value)
