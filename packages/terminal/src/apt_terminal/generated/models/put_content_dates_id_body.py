from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutContentDatesIdBody")


@_attrs_define
class PutContentDatesIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        owner_kind (Union[Unset, str]):
        owner_id (Union[Unset, str]):
        label (Union[Unset, str]):
        date (Union[Unset, str]):
        recurrence (Union[Unset, str]):
        contact_id (Union[None, Unset, str]):
        notes (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    owner_kind: Unset | str = UNSET
    owner_id: Unset | str = UNSET
    label: Unset | str = UNSET
    date: Unset | str = UNSET
    recurrence: Unset | str = UNSET
    contact_id: None | Unset | str = UNSET
    notes: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        owner_kind = self.owner_kind

        owner_id = self.owner_id

        label = self.label

        date = self.date

        recurrence = self.recurrence

        contact_id: Unset | str | None
        if isinstance(self.contact_id, Unset):
            contact_id = UNSET
        else:
            contact_id = self.contact_id

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
        if label is not UNSET:
            field_dict["label"] = label
        if date is not UNSET:
            field_dict["date"] = date
        if recurrence is not UNSET:
            field_dict["recurrence"] = recurrence
        if contact_id is not UNSET:
            field_dict["contactId"] = contact_id
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

        label = d.pop("label", UNSET)

        date = d.pop("date", UNSET)

        recurrence = d.pop("recurrence", UNSET)

        def _parse_contact_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        contact_id = _parse_contact_id(d.pop("contactId", UNSET))

        notes = d.pop("notes", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        put_content_dates_id_body = cls(
            ecosystem_id=ecosystem_id,
            owner_kind=owner_kind,
            owner_id=owner_id,
            label=label,
            date=date,
            recurrence=recurrence,
            contact_id=contact_id,
            notes=notes,
            sync_txid=sync_txid,
        )

        return put_content_dates_id_body
