from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutContentKeywordsIdBody")


@_attrs_define
class PutContentKeywordsIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        label (Union[Unset, str]):
        color (Union[Unset, str]):
        description (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    label: Unset | str = UNSET
    color: Unset | str = UNSET
    description: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        label = self.label

        color = self.color

        description = self.description

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if label is not UNSET:
            field_dict["label"] = label
        if color is not UNSET:
            field_dict["color"] = color
        if description is not UNSET:
            field_dict["description"] = description
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        label = d.pop("label", UNSET)

        color = d.pop("color", UNSET)

        description = d.pop("description", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        put_content_keywords_id_body = cls(
            ecosystem_id=ecosystem_id,
            label=label,
            color=color,
            description=description,
            sync_txid=sync_txid,
        )

        return put_content_keywords_id_body
