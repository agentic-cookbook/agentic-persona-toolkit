from enum import Enum


class BillingContextStripeStatus(str, Enum):
    CONNECTED = "connected"
    NOT_CONNECTED = "not_connected"
    UNKNOWN = "unknown"

    def __str__(self) -> str:
        return str(self.value)
