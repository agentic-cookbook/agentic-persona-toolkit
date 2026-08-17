from enum import Enum


class PutBucketAccessGroupsGroupIdGrantsBodyTargetType(str, Enum):
    BUCKET = "bucket"
    BUCKET_TYPE = "bucket_type"
    ROW = "row"

    def __str__(self) -> str:
        return str(self.value)
