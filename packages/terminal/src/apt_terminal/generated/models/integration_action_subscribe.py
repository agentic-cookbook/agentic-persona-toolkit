from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.integration_action_fields import IntegrationActionFields


T = TypeVar("T", bound="IntegrationActionSubscribe")


@_attrs_define
class IntegrationActionSubscribe:
    """actionType=subscribe — add or update one contact on a newsletter audience; audienceId is the PROVIDER list id

    Attributes:
        audience_id (str): Provider list id
        email (str):
        first_name (Union[Unset, str]):
        last_name (Union[Unset, str]):
        tags (Union[Unset, list[str]]):
        fields (Union[Unset, IntegrationActionFields]): Provider merge/custom fields — flat string, number, or boolean
            values
    """

    audience_id: str
    email: str
    first_name: Unset | str = UNSET
    last_name: Unset | str = UNSET
    tags: Unset | list[str] = UNSET
    fields: Union[Unset, "IntegrationActionFields"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        audience_id = self.audience_id

        email = self.email

        first_name = self.first_name

        last_name = self.last_name

        tags: Unset | list[str] = UNSET
        if not isinstance(self.tags, Unset):
            tags = self.tags

        fields: Unset | dict[str, Any] = UNSET
        if not isinstance(self.fields, Unset):
            fields = self.fields.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "audienceId": audience_id,
                "email": email,
            }
        )
        if first_name is not UNSET:
            field_dict["firstName"] = first_name
        if last_name is not UNSET:
            field_dict["lastName"] = last_name
        if tags is not UNSET:
            field_dict["tags"] = tags
        if fields is not UNSET:
            field_dict["fields"] = fields

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.integration_action_fields import IntegrationActionFields

        d = dict(src_dict)
        audience_id = d.pop("audienceId")

        email = d.pop("email")

        first_name = d.pop("firstName", UNSET)

        last_name = d.pop("lastName", UNSET)

        tags = cast(list[str], d.pop("tags", UNSET))

        _fields = d.pop("fields", UNSET)
        fields: Unset | IntegrationActionFields
        if isinstance(_fields, Unset):
            fields = UNSET
        else:
            fields = IntegrationActionFields.from_dict(_fields)

        integration_action_subscribe = cls(
            audience_id=audience_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            tags=tags,
            fields=fields,
        )

        integration_action_subscribe.additional_properties = d
        return integration_action_subscribe

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
