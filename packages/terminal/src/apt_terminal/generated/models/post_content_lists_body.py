from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostContentListsBody")


@_attrs_define
class PostContentListsBody:
    """
    Attributes:
        name (str):
        ecosystem_id (Union[Unset, str]):
        description (Union[None, Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    name: str
    ecosystem_id: Unset | str = UNSET
    description: None | Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        ecosystem_id = self.ecosystem_id

        description: None | Unset | str
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "name": name,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if description is not UNSET:
            field_dict["description"] = description
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_description(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        description = _parse_description(d.pop("description", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        post_content_lists_body = cls(
            name=name,
            ecosystem_id=ecosystem_id,
            description=description,
            sync_txid=sync_txid,
        )

        return post_content_lists_body
