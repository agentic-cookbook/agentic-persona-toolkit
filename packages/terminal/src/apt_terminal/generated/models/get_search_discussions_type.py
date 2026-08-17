from enum import Enum


class GetSearchDiscussionsType(str, Enum):
    POSTS = "posts"
    TOPICS = "topics"

    def __str__(self) -> str:
        return str(self.value)
