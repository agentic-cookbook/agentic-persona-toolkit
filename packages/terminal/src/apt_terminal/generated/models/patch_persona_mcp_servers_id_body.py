from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="PatchPersonaMcpServersIdBody")


@_attrs_define
class PatchPersonaMcpServersIdBody:
    """All fields optional. A blank or absent authSecret PRESERVES the stored secret; a present non-empty value rotates it.

    Attributes:
        name (Union[Unset, str]):
        url (Union[Unset, str]):
        enabled (Union[Unset, bool]):
        auth_secret (Union[Unset, str]): Blank/absent preserves the stored secret; a non-empty value rotates it
    """

    name: Unset | str = UNSET
    url: Unset | str = UNSET
    enabled: Unset | bool = UNSET
    auth_secret: Unset | str = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        url = self.url

        enabled = self.enabled

        auth_secret = self.auth_secret

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if url is not UNSET:
            field_dict["url"] = url
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if auth_secret is not UNSET:
            field_dict["authSecret"] = auth_secret

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        url = d.pop("url", UNSET)

        enabled = d.pop("enabled", UNSET)

        auth_secret = d.pop("authSecret", UNSET)

        patch_persona_mcp_servers_id_body = cls(
            name=name,
            url=url,
            enabled=enabled,
            auth_secret=auth_secret,
        )

        patch_persona_mcp_servers_id_body.additional_properties = d
        return patch_persona_mcp_servers_id_body

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
