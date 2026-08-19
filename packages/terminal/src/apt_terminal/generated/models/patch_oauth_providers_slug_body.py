from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.patch_oauth_providers_slug_body_identity_mapping import (
        PatchOauthProvidersSlugBodyIdentityMapping,
    )


T = TypeVar("T", bound="PatchOauthProvidersSlugBody")


@_attrs_define
class PatchOauthProvidersSlugBody:
    """
    Attributes:
        slug (Union[Unset, str]):
        display_name (Union[Unset, str]):
        client_id (Union[Unset, str]):
        client_secret (Union[Unset, str]):
        scopes (Union[Unset, list[str]]):
        authorize_url (Union[None, Unset, str]):
        token_url (Union[None, Unset, str]):
        userinfo_url (Union[None, Unset, str]):
        identity_mapping (Union[Unset, PatchOauthProvidersSlugBodyIdentityMapping]):
    """

    slug: Unset | str = UNSET
    display_name: Unset | str = UNSET
    client_id: Unset | str = UNSET
    client_secret: Unset | str = UNSET
    scopes: Unset | list[str] = UNSET
    authorize_url: None | Unset | str = UNSET
    token_url: None | Unset | str = UNSET
    userinfo_url: None | Unset | str = UNSET
    identity_mapping: Union[Unset, "PatchOauthProvidersSlugBodyIdentityMapping"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        slug = self.slug

        display_name = self.display_name

        client_id = self.client_id

        client_secret = self.client_secret

        scopes: Unset | list[str] = UNSET
        if not isinstance(self.scopes, Unset):
            scopes = self.scopes

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

        identity_mapping: Unset | dict[str, Any] = UNSET
        if not isinstance(self.identity_mapping, Unset):
            identity_mapping = self.identity_mapping.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if slug is not UNSET:
            field_dict["slug"] = slug
        if display_name is not UNSET:
            field_dict["displayName"] = display_name
        if client_id is not UNSET:
            field_dict["clientId"] = client_id
        if client_secret is not UNSET:
            field_dict["clientSecret"] = client_secret
        if scopes is not UNSET:
            field_dict["scopes"] = scopes
        if authorize_url is not UNSET:
            field_dict["authorizeUrl"] = authorize_url
        if token_url is not UNSET:
            field_dict["tokenUrl"] = token_url
        if userinfo_url is not UNSET:
            field_dict["userinfoUrl"] = userinfo_url
        if identity_mapping is not UNSET:
            field_dict["identityMapping"] = identity_mapping

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.patch_oauth_providers_slug_body_identity_mapping import (
            PatchOauthProvidersSlugBodyIdentityMapping,
        )

        d = dict(src_dict)
        slug = d.pop("slug", UNSET)

        display_name = d.pop("displayName", UNSET)

        client_id = d.pop("clientId", UNSET)

        client_secret = d.pop("clientSecret", UNSET)

        scopes = cast(list[str], d.pop("scopes", UNSET))

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

        _identity_mapping = d.pop("identityMapping", UNSET)
        identity_mapping: Unset | PatchOauthProvidersSlugBodyIdentityMapping
        if isinstance(_identity_mapping, Unset):
            identity_mapping = UNSET
        else:
            identity_mapping = PatchOauthProvidersSlugBodyIdentityMapping.from_dict(
                _identity_mapping
            )

        patch_oauth_providers_slug_body = cls(
            slug=slug,
            display_name=display_name,
            client_id=client_id,
            client_secret=client_secret,
            scopes=scopes,
            authorize_url=authorize_url,
            token_url=token_url,
            userinfo_url=userinfo_url,
            identity_mapping=identity_mapping,
        )

        patch_oauth_providers_slug_body.additional_properties = d
        return patch_oauth_providers_slug_body

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
