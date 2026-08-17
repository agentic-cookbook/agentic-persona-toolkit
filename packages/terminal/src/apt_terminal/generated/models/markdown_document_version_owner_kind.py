from enum import Enum


class MarkdownDocumentVersionOwnerKind(str, Enum):
    CUSTOMER = "customer"
    ORGANIZATION = "organization"

    def __str__(self) -> str:
        return str(self.value)
