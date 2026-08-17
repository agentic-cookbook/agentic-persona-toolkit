from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutEcosystemApplicationsIdBody")


@_attrs_define
class PutEcosystemApplicationsIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        slug (Union[Unset, str]):
        display_name (Union[Unset, str]):
        consumer_kind (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    slug: Unset | str = UNSET
    display_name: Unset | str = UNSET
    consumer_kind: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        slug = self.slug

        display_name = self.display_name

        consumer_kind = self.consumer_kind

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if slug is not UNSET:
            field_dict["slug"] = slug
        if display_name is not UNSET:
            field_dict["displayName"] = display_name
        if consumer_kind is not UNSET:
            field_dict["consumerKind"] = consumer_kind
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        slug = d.pop("slug", UNSET)

        display_name = d.pop("displayName", UNSET)

        consumer_kind = d.pop("consumerKind", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        put_ecosystem_applications_id_body = cls(
            ecosystem_id=ecosystem_id,
            slug=slug,
            display_name=display_name,
            consumer_kind=consumer_kind,
            sync_txid=sync_txid,
        )

        return put_ecosystem_applications_id_body
