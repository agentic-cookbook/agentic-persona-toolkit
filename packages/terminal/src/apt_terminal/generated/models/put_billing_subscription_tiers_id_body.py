from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutBillingSubscriptionTiersIdBody")


@_attrs_define
class PutBillingSubscriptionTiersIdBody:
    """
    Attributes:
        key (Union[Unset, str]):
        name (Union[Unset, str]):
        description (Union[None, Unset, str]):
        display_order (Union[Unset, int]):
        is_active (Union[Unset, bool]):
    """

    key: Unset | str = UNSET
    name: Unset | str = UNSET
    description: None | Unset | str = UNSET
    display_order: Unset | int = UNSET
    is_active: Unset | bool = UNSET

    def to_dict(self) -> dict[str, Any]:
        key = self.key

        name = self.name

        description: None | Unset | str
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        display_order = self.display_order

        is_active = self.is_active

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if key is not UNSET:
            field_dict["key"] = key
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if display_order is not UNSET:
            field_dict["displayOrder"] = display_order
        if is_active is not UNSET:
            field_dict["isActive"] = is_active

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key", UNSET)

        name = d.pop("name", UNSET)

        def _parse_description(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        description = _parse_description(d.pop("description", UNSET))

        display_order = d.pop("displayOrder", UNSET)

        is_active = d.pop("isActive", UNSET)

        put_billing_subscription_tiers_id_body = cls(
            key=key,
            name=name,
            description=description,
            display_order=display_order,
            is_active=is_active,
        )

        return put_billing_subscription_tiers_id_body
