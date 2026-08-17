from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutContentKeywordItemsIdBody")


@_attrs_define
class PutContentKeywordItemsIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        keyword_id (Union[Unset, str]):
        target_kind (Union[Unset, str]):
        target_id (Union[Unset, str]):
        sort_order (Union[Unset, int]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    keyword_id: Unset | str = UNSET
    target_kind: Unset | str = UNSET
    target_id: Unset | str = UNSET
    sort_order: Unset | int = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        keyword_id = self.keyword_id

        target_kind = self.target_kind

        target_id = self.target_id

        sort_order = self.sort_order

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if keyword_id is not UNSET:
            field_dict["keywordId"] = keyword_id
        if target_kind is not UNSET:
            field_dict["targetKind"] = target_kind
        if target_id is not UNSET:
            field_dict["targetId"] = target_id
        if sort_order is not UNSET:
            field_dict["sortOrder"] = sort_order
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        keyword_id = d.pop("keywordId", UNSET)

        target_kind = d.pop("targetKind", UNSET)

        target_id = d.pop("targetId", UNSET)

        sort_order = d.pop("sortOrder", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        put_content_keyword_items_id_body = cls(
            ecosystem_id=ecosystem_id,
            keyword_id=keyword_id,
            target_kind=target_kind,
            target_id=target_id,
            sort_order=sort_order,
            sync_txid=sync_txid,
        )

        return put_content_keyword_items_id_body
