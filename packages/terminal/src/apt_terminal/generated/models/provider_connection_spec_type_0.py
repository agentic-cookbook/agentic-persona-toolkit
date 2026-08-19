from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.provider_connection_spec_type_0_spec_version import (
    ProviderConnectionSpecType0SpecVersion,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.provider_connection_auth import ProviderConnectionAuth
    from ..models.provider_connection_header_var import ProviderConnectionHeaderVar
    from ..models.provider_connection_string_map import ProviderConnectionStringMap
    from ..models.provider_connection_url_var import ProviderConnectionUrlVar


T = TypeVar("T", bound="ProviderConnectionSpecType0")


@_attrs_define
class ProviderConnectionSpecType0:
    """
    Attributes:
        spec_version (ProviderConnectionSpecType0SpecVersion):
        url_vars (Union[Unset, list['ProviderConnectionUrlVar']]): base_url placeholders the connect UI prompts for and
            substitutes.
        header_vars (Union[Unset, list['ProviderConnectionHeaderVar']]): headers the connect UI prompts a per-connection
            value for and writes into extraHeaders.
        auth (Union[Unset, ProviderConnectionAuth]):
        default_query (Union[Unset, ProviderConnectionStringMap]):
        extra_headers (Union[Unset, ProviderConnectionStringMap]):
    """

    spec_version: ProviderConnectionSpecType0SpecVersion
    url_vars: Unset | list["ProviderConnectionUrlVar"] = UNSET
    header_vars: Unset | list["ProviderConnectionHeaderVar"] = UNSET
    auth: Union[Unset, "ProviderConnectionAuth"] = UNSET
    default_query: Union[Unset, "ProviderConnectionStringMap"] = UNSET
    extra_headers: Union[Unset, "ProviderConnectionStringMap"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        spec_version = self.spec_version.value

        url_vars: Unset | list[dict[str, Any]] = UNSET
        if not isinstance(self.url_vars, Unset):
            url_vars = []
            for url_vars_item_data in self.url_vars:
                url_vars_item = url_vars_item_data.to_dict()
                url_vars.append(url_vars_item)

        header_vars: Unset | list[dict[str, Any]] = UNSET
        if not isinstance(self.header_vars, Unset):
            header_vars = []
            for header_vars_item_data in self.header_vars:
                header_vars_item = header_vars_item_data.to_dict()
                header_vars.append(header_vars_item)

        auth: Unset | dict[str, Any] = UNSET
        if not isinstance(self.auth, Unset):
            auth = self.auth.to_dict()

        default_query: Unset | dict[str, Any] = UNSET
        if not isinstance(self.default_query, Unset):
            default_query = self.default_query.to_dict()

        extra_headers: Unset | dict[str, Any] = UNSET
        if not isinstance(self.extra_headers, Unset):
            extra_headers = self.extra_headers.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "specVersion": spec_version,
            }
        )
        if url_vars is not UNSET:
            field_dict["urlVars"] = url_vars
        if header_vars is not UNSET:
            field_dict["headerVars"] = header_vars
        if auth is not UNSET:
            field_dict["auth"] = auth
        if default_query is not UNSET:
            field_dict["defaultQuery"] = default_query
        if extra_headers is not UNSET:
            field_dict["extraHeaders"] = extra_headers

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.provider_connection_auth import ProviderConnectionAuth
        from ..models.provider_connection_header_var import ProviderConnectionHeaderVar
        from ..models.provider_connection_string_map import ProviderConnectionStringMap
        from ..models.provider_connection_url_var import ProviderConnectionUrlVar

        d = dict(src_dict)
        spec_version = ProviderConnectionSpecType0SpecVersion(d.pop("specVersion"))

        url_vars = []
        _url_vars = d.pop("urlVars", UNSET)
        for url_vars_item_data in _url_vars or []:
            url_vars_item = ProviderConnectionUrlVar.from_dict(url_vars_item_data)

            url_vars.append(url_vars_item)

        header_vars = []
        _header_vars = d.pop("headerVars", UNSET)
        for header_vars_item_data in _header_vars or []:
            header_vars_item = ProviderConnectionHeaderVar.from_dict(header_vars_item_data)

            header_vars.append(header_vars_item)

        _auth = d.pop("auth", UNSET)
        auth: Unset | ProviderConnectionAuth
        if isinstance(_auth, Unset):
            auth = UNSET
        else:
            auth = ProviderConnectionAuth.from_dict(_auth)

        _default_query = d.pop("defaultQuery", UNSET)
        default_query: Unset | ProviderConnectionStringMap
        if isinstance(_default_query, Unset):
            default_query = UNSET
        else:
            default_query = ProviderConnectionStringMap.from_dict(_default_query)

        _extra_headers = d.pop("extraHeaders", UNSET)
        extra_headers: Unset | ProviderConnectionStringMap
        if isinstance(_extra_headers, Unset):
            extra_headers = UNSET
        else:
            extra_headers = ProviderConnectionStringMap.from_dict(_extra_headers)

        provider_connection_spec_type_0 = cls(
            spec_version=spec_version,
            url_vars=url_vars,
            header_vars=header_vars,
            auth=auth,
            default_query=default_query,
            extra_headers=extra_headers,
        )

        provider_connection_spec_type_0.additional_properties = d
        return provider_connection_spec_type_0

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
