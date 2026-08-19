from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutContentContactsIdBody")


@_attrs_define
class PutContentContactsIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        owner_kind (Union[Unset, str]):
        owner_id (Union[Unset, str]):
        person_user_id (Union[None, Unset, str]):
        full_name (Union[Unset, str]):
        nickname (Union[Unset, str]):
        email (Union[Unset, str]):
        phone (Union[Unset, str]):
        notes (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    owner_kind: Unset | str = UNSET
    owner_id: Unset | str = UNSET
    person_user_id: None | Unset | str = UNSET
    full_name: Unset | str = UNSET
    nickname: Unset | str = UNSET
    email: Unset | str = UNSET
    phone: Unset | str = UNSET
    notes: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        owner_kind = self.owner_kind

        owner_id = self.owner_id

        person_user_id: Unset | str | None
        if isinstance(self.person_user_id, Unset):
            person_user_id = UNSET
        else:
            person_user_id = self.person_user_id

        full_name = self.full_name

        nickname = self.nickname

        email = self.email

        phone = self.phone

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
        if person_user_id is not UNSET:
            field_dict["personUserId"] = person_user_id
        if full_name is not UNSET:
            field_dict["fullName"] = full_name
        if nickname is not UNSET:
            field_dict["nickname"] = nickname
        if email is not UNSET:
            field_dict["email"] = email
        if phone is not UNSET:
            field_dict["phone"] = phone
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

        def _parse_person_user_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        person_user_id = _parse_person_user_id(d.pop("personUserId", UNSET))

        full_name = d.pop("fullName", UNSET)

        nickname = d.pop("nickname", UNSET)

        email = d.pop("email", UNSET)

        phone = d.pop("phone", UNSET)

        notes = d.pop("notes", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        put_content_contacts_id_body = cls(
            ecosystem_id=ecosystem_id,
            owner_kind=owner_kind,
            owner_id=owner_id,
            person_user_id=person_user_id,
            full_name=full_name,
            nickname=nickname,
            email=email,
            phone=phone,
            notes=notes,
            sync_txid=sync_txid,
        )

        return put_content_contacts_id_body
