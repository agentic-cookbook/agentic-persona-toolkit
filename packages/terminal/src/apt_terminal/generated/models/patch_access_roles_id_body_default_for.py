from enum import Enum


class PatchAccessRolesIdBodyDefaultFor(str, Enum):
    CUSTOMER = "customer"
    PERSONA = "persona"
    VALUE_0 = ""

    def __str__(self) -> str:
        return str(self.value)
