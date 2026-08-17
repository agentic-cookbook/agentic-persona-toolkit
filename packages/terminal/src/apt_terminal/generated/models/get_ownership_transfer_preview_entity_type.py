from enum import Enum


class GetOwnershipTransferPreviewEntityType(str, Enum):
    APPLICATION = "application"
    BUCKET = "bucket"
    ECOSYSTEM = "ecosystem"
    PERSONA = "persona"
    PROJECT = "project"
    SITE_GROUP = "site-group"

    def __str__(self) -> str:
        return str(self.value)
