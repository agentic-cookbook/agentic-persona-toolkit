from enum import Enum


class MarkdownDocumentKind(str, Enum):
    PAPER = "paper"
    RESEARCH = "research"

    def __str__(self) -> str:
        return str(self.value)
