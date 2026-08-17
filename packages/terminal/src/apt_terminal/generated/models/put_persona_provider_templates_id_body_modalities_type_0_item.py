from enum import Enum


class PutPersonaProviderTemplatesIdBodyModalitiesType0Item(str, Enum):
    CHAT = "chat"
    IMAGE = "image"
    VIDEO = "video"

    def __str__(self) -> str:
        return str(self.value)
