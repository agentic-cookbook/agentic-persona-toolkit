from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutContentSocialLinksIdBody")


@_attrs_define
class PutContentSocialLinksIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        owner_kind (Union[Unset, str]):
        owner_id (Union[Unset, str]):
        platform (Union[Unset, str]):
        url (Union[Unset, str]):
        handle (Union[Unset, str]):
        sort_order (Union[Unset, int]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    owner_kind: Unset | str = UNSET
    owner_id: Unset | str = UNSET
    platform: Unset | str = UNSET
    url: Unset | str = UNSET
    handle: Unset | str = UNSET
    sort_order: Unset | int = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        owner_kind = self.owner_kind

        owner_id = self.owner_id

        platform = self.platform

        url = self.url

        handle = self.handle

        sort_order = self.sort_order

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if owner_kind is not UNSET:
            field_dict["ownerKind"] = owner_kind
        if owner_id is not UNSET:
            field_dict["ownerId"] = owner_id
        if platform is not UNSET:
            field_dict["platform"] = platform
        if url is not UNSET:
            field_dict["url"] = url
        if handle is not UNSET:
            field_dict["handle"] = handle
        if sort_order is not UNSET:
            field_dict["sortOrder"] = sort_order
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        owner_kind = d.pop("ownerKind", UNSET)

        owner_id = d.pop("ownerId", UNSET)

        platform = d.pop("platform", UNSET)

        url = d.pop("url", UNSET)

        handle = d.pop("handle", UNSET)

        sort_order = d.pop("sortOrder", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        put_content_social_links_id_body = cls(
            ecosystem_id=ecosystem_id,
            owner_kind=owner_kind,
            owner_id=owner_id,
            platform=platform,
            url=url,
            handle=handle,
            sort_order=sort_order,
            sync_txid=sync_txid,
        )

        return put_content_social_links_id_body
