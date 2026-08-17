from enum import Enum


class PostProjectProjectsIdArtifactsBodyTargetKind(str, Enum):
    CONTENT_MARKDOWN = "content.markdown"
    CONTENT_URLS = "content.urls"

    def __str__(self) -> str:
        return str(self.value)
