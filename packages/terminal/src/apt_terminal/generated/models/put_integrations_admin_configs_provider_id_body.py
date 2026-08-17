from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.put_integrations_admin_configs_provider_id_body_credential_style import (
    PutIntegrationsAdminConfigsProviderIdBodyCredentialStyle,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.put_integrations_admin_configs_provider_id_body_endpoints import (
        PutIntegrationsAdminConfigsProviderIdBodyEndpoints,
    )


T = TypeVar("T", bound="PutIntegrationsAdminConfigsProviderIdBody")


@_attrs_define
class PutIntegrationsAdminConfigsProviderIdBody:
    """
    Attributes:
        client_id (Union[Unset, str]):
        scopes (Union[Unset, list[str]]):
        auth_url (Union[Unset, str]):
        token_url (Union[Unset, str]):
        userinfo_url (Union[Unset, str]):
        validate_url (Union[Unset, str]):
        credential_style (Union[Unset, PutIntegrationsAdminConfigsProviderIdBodyCredentialStyle]):
        endpoints (Union[Unset, PutIntegrationsAdminConfigsProviderIdBodyEndpoints]):
        client_secret (Union[Unset, str]): Blank/absent preserves the existing secret
    """

    client_id: Unset | str = UNSET
    scopes: Unset | list[str] = UNSET
    auth_url: Unset | str = UNSET
    token_url: Unset | str = UNSET
    userinfo_url: Unset | str = UNSET
    validate_url: Unset | str = UNSET
    credential_style: Unset | PutIntegrationsAdminConfigsProviderIdBodyCredentialStyle = UNSET
    endpoints: Union[Unset, "PutIntegrationsAdminConfigsProviderIdBodyEndpoints"] = UNSET
    client_secret: Unset | str = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        client_id = self.client_id

        scopes: Unset | list[str] = UNSET
        if not isinstance(self.scopes, Unset):
            scopes = self.scopes

        auth_url = self.auth_url

        token_url = self.token_url

        userinfo_url = self.userinfo_url

        validate_url = self.validate_url

        credential_style: Unset | str = UNSET
        if not isinstance(self.credential_style, Unset):
            credential_style = self.credential_style.value

        endpoints: Unset | dict[str, Any] = UNSET
        if not isinstance(self.endpoints, Unset):
            endpoints = self.endpoints.to_dict()

        client_secret = self.client_secret

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if client_id is not UNSET:
            field_dict["clientId"] = client_id
        if scopes is not UNSET:
            field_dict["scopes"] = scopes
        if auth_url is not UNSET:
            field_dict["authUrl"] = auth_url
        if token_url is not UNSET:
            field_dict["tokenUrl"] = token_url
        if userinfo_url is not UNSET:
            field_dict["userinfoUrl"] = userinfo_url
        if validate_url is not UNSET:
            field_dict["validateUrl"] = validate_url
        if credential_style is not UNSET:
            field_dict["credentialStyle"] = credential_style
        if endpoints is not UNSET:
            field_dict["endpoints"] = endpoints
        if client_secret is not UNSET:
            field_dict["clientSecret"] = client_secret

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_integrations_admin_configs_provider_id_body_endpoints import (
            PutIntegrationsAdminConfigsProviderIdBodyEndpoints,
        )

        d = dict(src_dict)
        client_id = d.pop("clientId", UNSET)

        scopes = cast(list[str], d.pop("scopes", UNSET))

        auth_url = d.pop("authUrl", UNSET)

        token_url = d.pop("tokenUrl", UNSET)

        userinfo_url = d.pop("userinfoUrl", UNSET)

        validate_url = d.pop("validateUrl", UNSET)

        _credential_style = d.pop("credentialStyle", UNSET)
        credential_style: Unset | PutIntegrationsAdminConfigsProviderIdBodyCredentialStyle
        if isinstance(_credential_style, Unset):
            credential_style = UNSET
        else:
            credential_style = PutIntegrationsAdminConfigsProviderIdBodyCredentialStyle(
                _credential_style
            )

        _endpoints = d.pop("endpoints", UNSET)
        endpoints: Unset | PutIntegrationsAdminConfigsProviderIdBodyEndpoints
        if isinstance(_endpoints, Unset):
            endpoints = UNSET
        else:
            endpoints = PutIntegrationsAdminConfigsProviderIdBodyEndpoints.from_dict(_endpoints)

        client_secret = d.pop("clientSecret", UNSET)

        put_integrations_admin_configs_provider_id_body = cls(
            client_id=client_id,
            scopes=scopes,
            auth_url=auth_url,
            token_url=token_url,
            userinfo_url=userinfo_url,
            validate_url=validate_url,
            credential_style=credential_style,
            endpoints=endpoints,
            client_secret=client_secret,
        )

        put_integrations_admin_configs_provider_id_body.additional_properties = d
        return put_integrations_admin_configs_provider_id_body

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
