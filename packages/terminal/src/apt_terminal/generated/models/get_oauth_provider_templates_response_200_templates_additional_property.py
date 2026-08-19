from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.get_oauth_provider_templates_response_200_templates_additional_property_auth_type import (
    GetOauthProviderTemplatesResponse200TemplatesAdditionalPropertyAuthType,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.get_oauth_provider_templates_response_200_templates_additional_property_identity_mapping import (
        GetOauthProviderTemplatesResponse200TemplatesAdditionalPropertyIdentityMapping,
    )


T = TypeVar("T", bound="GetOauthProviderTemplatesResponse200TemplatesAdditionalProperty")


@_attrs_define
class GetOauthProviderTemplatesResponse200TemplatesAdditionalProperty:
    """
    Attributes:
        slug (str):
        name (str):
        auth_type (GetOauthProviderTemplatesResponse200TemplatesAdditionalPropertyAuthType):
        authorize_url (Union[None, Unset, str]):
        token_url (Union[None, Unset, str]):
        userinfo_url (Union[None, Unset, str]):
        default_scopes (Union[Unset, list[str]]):
        identity_mapping (Union[Unset, GetOauthProviderTemplatesResponse200TemplatesAdditionalPropertyIdentityMapping]):
    """

    slug: str
    name: str
    auth_type: GetOauthProviderTemplatesResponse200TemplatesAdditionalPropertyAuthType
    authorize_url: None | Unset | str = UNSET
    token_url: None | Unset | str = UNSET
    userinfo_url: None | Unset | str = UNSET
    default_scopes: Unset | list[str] = UNSET
    identity_mapping: Union[
        Unset, "GetOauthProviderTemplatesResponse200TemplatesAdditionalPropertyIdentityMapping"
    ] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        slug = self.slug

        name = self.name

        auth_type = self.auth_type.value

        authorize_url: Unset | str | None
        if isinstance(self.authorize_url, Unset):
            authorize_url = UNSET
        else:
            authorize_url = self.authorize_url

        token_url: Unset | str | None
        if isinstance(self.token_url, Unset):
            token_url = UNSET
        else:
            token_url = self.token_url

        userinfo_url: Unset | str | None
        if isinstance(self.userinfo_url, Unset):
            userinfo_url = UNSET
        else:
            userinfo_url = self.userinfo_url

        default_scopes: Unset | list[str] = UNSET
        if not isinstance(self.default_scopes, Unset):
            default_scopes = self.default_scopes

        identity_mapping: Unset | dict[str, Any] = UNSET
        if not isinstance(self.identity_mapping, Unset):
            identity_mapping = self.identity_mapping.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "slug": slug,
                "name": name,
                "authType": auth_type,
            }
        )
        if authorize_url is not UNSET:
            field_dict["authorizeUrl"] = authorize_url
        if token_url is not UNSET:
            field_dict["tokenUrl"] = token_url
        if userinfo_url is not UNSET:
            field_dict["userinfoUrl"] = userinfo_url
        if default_scopes is not UNSET:
            field_dict["defaultScopes"] = default_scopes
        if identity_mapping is not UNSET:
            field_dict["identityMapping"] = identity_mapping

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_oauth_provider_templates_response_200_templates_additional_property_identity_mapping import (
            GetOauthProviderTemplatesResponse200TemplatesAdditionalPropertyIdentityMapping,
        )

        d = dict(src_dict)
        slug = d.pop("slug")

        name = d.pop("name")

        auth_type = GetOauthProviderTemplatesResponse200TemplatesAdditionalPropertyAuthType(
            d.pop("authType")
        )

        def _parse_authorize_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        authorize_url = _parse_authorize_url(d.pop("authorizeUrl", UNSET))

        def _parse_token_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        token_url = _parse_token_url(d.pop("tokenUrl", UNSET))

        def _parse_userinfo_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        userinfo_url = _parse_userinfo_url(d.pop("userinfoUrl", UNSET))

        default_scopes = cast(list[str], d.pop("defaultScopes", UNSET))

        _identity_mapping = d.pop("identityMapping", UNSET)
        identity_mapping: (
            Unset | GetOauthProviderTemplatesResponse200TemplatesAdditionalPropertyIdentityMapping
        )
        if isinstance(_identity_mapping, Unset):
            identity_mapping = UNSET
        else:
            identity_mapping = GetOauthProviderTemplatesResponse200TemplatesAdditionalPropertyIdentityMapping.from_dict(
                _identity_mapping
            )

        get_oauth_provider_templates_response_200_templates_additional_property = cls(
            slug=slug,
            name=name,
            auth_type=auth_type,
            authorize_url=authorize_url,
            token_url=token_url,
            userinfo_url=userinfo_url,
            default_scopes=default_scopes,
            identity_mapping=identity_mapping,
        )

        get_oauth_provider_templates_response_200_templates_additional_property.additional_properties = d
        return get_oauth_provider_templates_response_200_templates_additional_property

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
