from enum import Enum


class PostPersonaProviderTemplatesBodyModalitiesType0Item(str, Enum):
    CHAT = "chat"
    IMAGE = "image"
    VIDEO = "video"

    def __str__(self) -> str:
        return str(self.value)
