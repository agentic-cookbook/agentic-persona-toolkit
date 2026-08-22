from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_persona_memory_blocks_body_content_type_1 import (
        PostPersonaMemoryBlocksBodyContentType1,
    )


T = TypeVar("T", bound="PostPersonaMemoryBlocksBody")


@_attrs_define
class PostPersonaMemoryBlocksBody:
    """
    Attributes:
        name (str):
        content (Union['PostPersonaMemoryBlocksBodyContentType1', None, bool, float, list[Any], str]):
        ecosystem_id (Union[Unset, str]):
        size_limit (Union[None, Unset, int]):
        sync_txid (Union[Unset, int]):
    """

    name: str
    content: Union["PostPersonaMemoryBlocksBodyContentType1", None, bool, float, list[Any], str]
    ecosystem_id: Unset | str = UNSET
    size_limit: None | Unset | int = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_persona_memory_blocks_body_content_type_1 import (
            PostPersonaMemoryBlocksBodyContentType1,
        )

        name = self.name

        content: None | bool | dict[str, Any] | float | list[Any] | str
        if isinstance(self.content, PostPersonaMemoryBlocksBodyContentType1):
            content = self.content.to_dict()
        elif isinstance(self.content, list):
            content = self.content

        else:
            content = self.content

        ecosystem_id = self.ecosystem_id

        size_limit: None | Unset | int
        if isinstance(self.size_limit, Unset):
            size_limit = UNSET
        else:
            size_limit = self.size_limit

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "name": name,
                "content": content,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if size_limit is not UNSET:
            field_dict["sizeLimit"] = size_limit
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_persona_memory_blocks_body_content_type_1 import (
            PostPersonaMemoryBlocksBodyContentType1,
        )

        d = dict(src_dict)
        name = d.pop("name")

        def _parse_content(
            data: object,
        ) -> Union["PostPersonaMemoryBlocksBodyContentType1", None, bool, float, list[Any], str]:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                content_type_1 = PostPersonaMemoryBlocksBodyContentType1.from_dict(data)

                return content_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                content_type_2 = cast(list[Any], data)

                return content_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union["PostPersonaMemoryBlocksBodyContentType1", None, bool, float, list[Any], str],
                data,
            )

        content = _parse_content(d.pop("content"))

        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_size_limit(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        size_limit = _parse_size_limit(d.pop("sizeLimit", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        post_persona_memory_blocks_body = cls(
            name=name,
            content=content,
            ecosystem_id=ecosystem_id,
            size_limit=size_limit,
            sync_txid=sync_txid,
        )

        return post_persona_memory_blocks_body
