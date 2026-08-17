from enum import Enum


class GetCommunitiesIdTopicsSort(str, Enum):
    POPULAR = "popular"
    RECENT = "recent"
    TRENDING = "trending"

    def __str__(self) -> str:
        return str(self.value)
