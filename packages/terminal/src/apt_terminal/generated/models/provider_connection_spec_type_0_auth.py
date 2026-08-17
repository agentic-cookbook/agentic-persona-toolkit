from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.provider_connection_spec_type_0_auth_scheme import (
    ProviderConnectionSpecType0AuthScheme,
)
from ..models.provider_connection_spec_type_0_auth_type import ProviderConnectionSpecType0AuthType
from ..types import UNSET, Unset

T = TypeVar("T", bound="ProviderConnectionSpecType0Auth")


@_attrs_define
class ProviderConnectionSpecType0Auth:
    """
    Attributes:
        type_ (ProviderConnectionSpecType0AuthType):
        header (Union[Unset, str]): header auth: the header name (e.g. api-key)
        scheme (Union[Unset, ProviderConnectionSpecType0AuthScheme]):
        region (Union[Unset, str]): sigv4 (reserved)
        token_url (Union[Unset, str]): oauth2 (reserved)
    """

    type_: ProviderConnectionSpecType0AuthType
    header: Unset | str = UNSET
    scheme: Unset | ProviderConnectionSpecType0AuthScheme = UNSET
    region: Unset | str = UNSET
    token_url: Unset | str = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        header = self.header

        scheme: Unset | str = UNSET
        if not isinstance(self.scheme, Unset):
            scheme = self.scheme.value

        region = self.region

        token_url = self.token_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
            }
        )
        if header is not UNSET:
            field_dict["header"] = header
        if scheme is not UNSET:
            field_dict["scheme"] = scheme
        if region is not UNSET:
            field_dict["region"] = region
        if token_url is not UNSET:
            field_dict["tokenUrl"] = token_url

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = ProviderConnectionSpecType0AuthType(d.pop("type"))

        header = d.pop("header", UNSET)

        _scheme = d.pop("scheme", UNSET)
        scheme: Unset | ProviderConnectionSpecType0AuthScheme
        if isinstance(_scheme, Unset):
            scheme = UNSET
        else:
            scheme = ProviderConnectionSpecType0AuthScheme(_scheme)

        region = d.pop("region", UNSET)

        token_url = d.pop("tokenUrl", UNSET)

        provider_connection_spec_type_0_auth = cls(
            type_=type_,
            header=header,
            scheme=scheme,
            region=region,
            token_url=token_url,
        )

        provider_connection_spec_type_0_auth.additional_properties = d
        return provider_connection_spec_type_0_auth

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
