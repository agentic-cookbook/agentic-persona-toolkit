from enum import Enum


class PostPersonaProviderTemplatesBodyProviderKind(str, Enum):
    ANTHROPIC = "anthropic"
    EXTERNAL = "external"
    GEMINI = "gemini"
    OPENAI = "openai"

    def __str__(self) -> str:
        return str(self.value)
