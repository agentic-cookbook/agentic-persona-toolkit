from enum import Enum


class CampaignStatus(str, Enum):
    CANCELLED = "cancelled"
    DRAFT = "draft"
    FAILED = "failed"
    SCHEDULED = "scheduled"
    SENDING = "sending"
    SENT = "sent"

    def __str__(self) -> str:
        return str(self.value)
