from enum import Enum


class PatchProjectProjectsIdFieldsFieldIdBodyType(str, Enum):
    CHECKBOX = "checkbox"
    DATE = "date"
    NUMBER = "number"
    SELECT = "select"
    TEXT = "text"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
