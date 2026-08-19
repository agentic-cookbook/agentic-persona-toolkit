from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostContentLocationsBody")


@_attrs_define
class PostContentLocationsBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        owner_kind (Union[Unset, str]):
        owner_id (Union[Unset, str]):
        place (Union[Unset, str]):
        region (Union[Unset, str]):
        country (Union[Unset, str]):
        start_date (Union[Unset, str]):
        end_date (Union[None, Unset, str]):
        notes (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    owner_kind: Unset | str = UNSET
    owner_id: Unset | str = UNSET
    place: Unset | str = UNSET
    region: Unset | str = UNSET
    country: Unset | str = UNSET
    start_date: Unset | str = UNSET
    end_date: None | Unset | str = UNSET
    notes: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        owner_kind = self.owner_kind

        owner_id = self.owner_id

        place = self.place

        region = self.region

        country = self.country

        start_date = self.start_date

        end_date: Unset | str | None
        if isinstance(self.end_date, Unset):
            end_date = UNSET
        else:
            end_date = self.end_date

        notes = self.notes

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if owner_kind is not UNSET:
            field_dict["ownerKind"] = owner_kind
        if owner_id is not UNSET:
            field_dict["ownerId"] = owner_id
        if place is not UNSET:
            field_dict["place"] = place
        if region is not UNSET:
            field_dict["region"] = region
        if country is not UNSET:
            field_dict["country"] = country
        if start_date is not UNSET:
            field_dict["startDate"] = start_date
        if end_date is not UNSET:
            field_dict["endDate"] = end_date
        if notes is not UNSET:
            field_dict["notes"] = notes
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        owner_kind = d.pop("ownerKind", UNSET)

        owner_id = d.pop("ownerId", UNSET)

        place = d.pop("place", UNSET)

        region = d.pop("region", UNSET)

        country = d.pop("country", UNSET)

        start_date = d.pop("startDate", UNSET)

        def _parse_end_date(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        end_date = _parse_end_date(d.pop("endDate", UNSET))

        notes = d.pop("notes", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        post_content_locations_body = cls(
            ecosystem_id=ecosystem_id,
            owner_kind=owner_kind,
            owner_id=owner_id,
            place=place,
            region=region,
            country=country,
            start_date=start_date,
            end_date=end_date,
            notes=notes,
            sync_txid=sync_txid,
        )

        return post_content_locations_body
