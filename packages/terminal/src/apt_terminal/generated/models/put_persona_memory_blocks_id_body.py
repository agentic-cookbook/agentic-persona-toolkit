from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.put_persona_memory_blocks_id_body_content_type_1 import (
        PutPersonaMemoryBlocksIdBodyContentType1,
    )


T = TypeVar("T", bound="PutPersonaMemoryBlocksIdBody")


@_attrs_define
class PutPersonaMemoryBlocksIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        name (Union[Unset, str]):
        content (Union['PutPersonaMemoryBlocksIdBodyContentType1', None, Unset, bool, float, list[Any], str]):
        size_limit (Union[None, Unset, int]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    name: Unset | str = UNSET
    content: Union[
        "PutPersonaMemoryBlocksIdBodyContentType1", None, Unset, bool, float, list[Any], str
    ] = UNSET
    size_limit: None | Unset | int = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_persona_memory_blocks_id_body_content_type_1 import (
            PutPersonaMemoryBlocksIdBodyContentType1,
        )

        ecosystem_id = self.ecosystem_id

        name = self.name

        content: Unset | bool | dict[str, Any] | float | list[Any] | str | None
        if isinstance(self.content, Unset):
            content = UNSET
        elif isinstance(self.content, PutPersonaMemoryBlocksIdBodyContentType1):
            content = self.content.to_dict()
        elif isinstance(self.content, list):
            content = self.content

        else:
            content = self.content

        size_limit: Unset | int | None
        if isinstance(self.size_limit, Unset):
            size_limit = UNSET
        else:
            size_limit = self.size_limit

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if name is not UNSET:
            field_dict["name"] = name
        if content is not UNSET:
            field_dict["content"] = content
        if size_limit is not UNSET:
            field_dict["sizeLimit"] = size_limit
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_persona_memory_blocks_id_body_content_type_1 import (
            PutPersonaMemoryBlocksIdBodyContentType1,
        )

        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        name = d.pop("name", UNSET)

        def _parse_content(
            data: object,
        ) -> Union[
            "PutPersonaMemoryBlocksIdBodyContentType1", None, Unset, bool, float, list[Any], str
        ]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                content_type_1 = PutPersonaMemoryBlocksIdBodyContentType1.from_dict(data)

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
                Union[
                    "PutPersonaMemoryBlocksIdBodyContentType1",
                    None,
                    Unset,
                    bool,
                    float,
                    list[Any],
                    str,
                ],
                data,
            )

        content = _parse_content(d.pop("content", UNSET))

        def _parse_size_limit(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        size_limit = _parse_size_limit(d.pop("sizeLimit", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        put_persona_memory_blocks_id_body = cls(
            ecosystem_id=ecosystem_id,
            name=name,
            content=content,
            size_limit=size_limit,
            sync_txid=sync_txid,
        )

        return put_persona_memory_blocks_id_body
