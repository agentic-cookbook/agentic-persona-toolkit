from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutCustomerCustomersIdBody")


@_attrs_define
class PutCustomerCustomersIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        external_id (Union[None, Unset, str]):
        email (Union[None, Unset, str]):
        display_name (Union[None, Unset, str]):
        slug (Union[Unset, str]):
        avatar_url (Union[Unset, str]):
        profile_visibility (Union[Unset, str]):
        token_version (Union[Unset, int]):
        preferred_mfa_method (Union[None, Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    external_id: None | Unset | str = UNSET
    email: None | Unset | str = UNSET
    display_name: None | Unset | str = UNSET
    slug: Unset | str = UNSET
    avatar_url: Unset | str = UNSET
    profile_visibility: Unset | str = UNSET
    token_version: Unset | int = UNSET
    preferred_mfa_method: None | Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        external_id: None | Unset | str
        if isinstance(self.external_id, Unset):
            external_id = UNSET
        else:
            external_id = self.external_id

        email: None | Unset | str
        if isinstance(self.email, Unset):
            email = UNSET
        else:
            email = self.email

        display_name: None | Unset | str
        if isinstance(self.display_name, Unset):
            display_name = UNSET
        else:
            display_name = self.display_name

        slug = self.slug

        avatar_url = self.avatar_url

        profile_visibility = self.profile_visibility

        token_version = self.token_version

        preferred_mfa_method: None | Unset | str
        if isinstance(self.preferred_mfa_method, Unset):
            preferred_mfa_method = UNSET
        else:
            preferred_mfa_method = self.preferred_mfa_method

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if external_id is not UNSET:
            field_dict["externalId"] = external_id
        if email is not UNSET:
            field_dict["email"] = email
        if display_name is not UNSET:
            field_dict["displayName"] = display_name
        if slug is not UNSET:
            field_dict["slug"] = slug
        if avatar_url is not UNSET:
            field_dict["avatarUrl"] = avatar_url
        if profile_visibility is not UNSET:
            field_dict["profileVisibility"] = profile_visibility
        if token_version is not UNSET:
            field_dict["tokenVersion"] = token_version
        if preferred_mfa_method is not UNSET:
            field_dict["preferredMfaMethod"] = preferred_mfa_method
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_external_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        external_id = _parse_external_id(d.pop("externalId", UNSET))

        def _parse_email(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        email = _parse_email(d.pop("email", UNSET))

        def _parse_display_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        display_name = _parse_display_name(d.pop("displayName", UNSET))

        slug = d.pop("slug", UNSET)

        avatar_url = d.pop("avatarUrl", UNSET)

        profile_visibility = d.pop("profileVisibility", UNSET)

        token_version = d.pop("tokenVersion", UNSET)

        def _parse_preferred_mfa_method(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        preferred_mfa_method = _parse_preferred_mfa_method(d.pop("preferredMfaMethod", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        put_customer_customers_id_body = cls(
            ecosystem_id=ecosystem_id,
            external_id=external_id,
            email=email,
            display_name=display_name,
            slug=slug,
            avatar_url=avatar_url,
            profile_visibility=profile_visibility,
            token_version=token_version,
            preferred_mfa_method=preferred_mfa_method,
            sync_txid=sync_txid,
        )

        return put_customer_customers_id_body
