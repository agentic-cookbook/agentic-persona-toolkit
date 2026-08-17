from enum import Enum


class IterationWorkItemEstimateScale(str, Enum):
    EXPONENTIAL = "exponential"
    FIBONACCI = "fibonacci"
    LINEAR = "linear"
    NONE = "none"
    POINTS = "points"
    TSHIRT = "tshirt"

    def __str__(self) -> str:
        return str(self.value)
