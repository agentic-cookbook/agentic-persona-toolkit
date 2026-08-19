from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="CampaignPatch")


@_attrs_define
class CampaignPatch:
    """All fields optional; only present on a campaign still in draft.

    Attributes:
        name (Union[Unset, str]):
        subject (Union[Unset, str]):
        html_body (Union[Unset, str]):
        text_body (Union[Unset, str]):
        from_name (Union[None, Unset, str]):
    """

    name: Unset | str = UNSET
    subject: Unset | str = UNSET
    html_body: Unset | str = UNSET
    text_body: Unset | str = UNSET
    from_name: None | Unset | str = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        subject = self.subject

        html_body = self.html_body

        text_body = self.text_body

        from_name: Unset | str | None
        if isinstance(self.from_name, Unset):
            from_name = UNSET
        else:
            from_name = self.from_name

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if subject is not UNSET:
            field_dict["subject"] = subject
        if html_body is not UNSET:
            field_dict["htmlBody"] = html_body
        if text_body is not UNSET:
            field_dict["textBody"] = text_body
        if from_name is not UNSET:
            field_dict["fromName"] = from_name

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        subject = d.pop("subject", UNSET)

        html_body = d.pop("htmlBody", UNSET)

        text_body = d.pop("textBody", UNSET)

        def _parse_from_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        from_name = _parse_from_name(d.pop("fromName", UNSET))

        campaign_patch = cls(
            name=name,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            from_name=from_name,
        )

        campaign_patch.additional_properties = d
        return campaign_patch

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
