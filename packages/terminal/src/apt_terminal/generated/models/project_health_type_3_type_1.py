from enum import Enum


class ProjectHealthType3Type1(str, Enum):
    AT_RISK = "at_risk"
    OFF_TRACK = "off_track"
    ON_TRACK = "on_track"

    def __str__(self) -> str:
        return str(self.value)
