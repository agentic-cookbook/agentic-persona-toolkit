from enum import Enum


class PostProjectProjectsIdFieldsBodyType(str, Enum):
    CHECKBOX = "checkbox"
    DATE = "date"
    NUMBER = "number"
    SELECT = "select"
    TEXT = "text"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
