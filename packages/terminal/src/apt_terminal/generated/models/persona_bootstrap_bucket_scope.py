from enum import Enum


class PersonaBootstrapBucketScope(str, Enum):
    GLOBAL = "global"

    def __str__(self) -> str:
        return str(self.value)
