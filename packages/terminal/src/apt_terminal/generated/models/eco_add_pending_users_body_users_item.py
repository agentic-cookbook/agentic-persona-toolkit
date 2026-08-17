from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="EcoAddPendingUsersBodyUsersItem")


@_attrs_define
class EcoAddPendingUsersBodyUsersItem:
    """
    Attributes:
        name (str):
        email (Union[Unset, str]):
        phone (Union[Unset, str]):
        note (Union[Unset, str]):
    """

    name: str
    email: Unset | str = UNSET
    phone: Unset | str = UNSET
    note: Unset | str = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        email = self.email

        phone = self.phone

        note = self.note

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
            }
        )
        if email is not UNSET:
            field_dict["email"] = email
        if phone is not UNSET:
            field_dict["phone"] = phone
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        email = d.pop("email", UNSET)

        phone = d.pop("phone", UNSET)

        note = d.pop("note", UNSET)

        eco_add_pending_users_body_users_item = cls(
            name=name,
            email=email,
            phone=phone,
            note=note,
        )

        eco_add_pending_users_body_users_item.additional_properties = d
        return eco_add_pending_users_body_users_item

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
