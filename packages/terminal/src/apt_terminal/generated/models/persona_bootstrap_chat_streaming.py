from enum import Enum


class PersonaBootstrapChatStreaming(str, Enum):
    SSE = "sse"

    def __str__(self) -> str:
        return str(self.value)
