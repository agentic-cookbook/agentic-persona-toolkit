from enum import Enum


class PostRegistryRegistriesIdFieldDefsBodyShowIfType0Op(str, Enum):
    CONTAINS = "contains"
    EQ = "eq"
    FALSY = "falsy"
    IN = "in"
    NE = "ne"
    TRUTHY = "truthy"

    def __str__(self) -> str:
        return str(self.value)
