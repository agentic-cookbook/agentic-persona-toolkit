from enum import Enum


class MarkdownDocumentStage(str, Enum):
    DRAFT = "draft"
    FINAL = "final"

    def __str__(self) -> str:
        return str(self.value)
