from enum import Enum


class GamificationRealmBadgeInputComparator(str, Enum):
    VALUE_0 = ">="
    VALUE_1 = ">"
    VALUE_2 = "="

    def __str__(self) -> str:
        return str(self.value)
