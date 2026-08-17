from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutContentCountersIdBody")


@_attrs_define
class PutContentCountersIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        name (Union[Unset, str]):
        value (Union[Unset, int]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    name: Unset | str = UNSET
    value: Unset | int = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        name = self.name

        value = self.value

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if name is not UNSET:
            field_dict["name"] = name
        if value is not UNSET:
            field_dict["value"] = value
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        name = d.pop("name", UNSET)

        value = d.pop("value", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        put_content_counters_id_body = cls(
            ecosystem_id=ecosystem_id,
            name=name,
            value=value,
            sync_txid=sync_txid,
        )

        return put_content_counters_id_body
