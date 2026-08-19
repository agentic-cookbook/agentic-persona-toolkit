from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="CommunityDirectoryEntry")


@_attrs_define
class CommunityDirectoryEntry:
    """
    Attributes:
        customer_id (str):
        role (str): owner | admin | moderator | member
        joined_at (str):
        post_count (int): Live posts by this member in this community.
        active_category_ids (list[str]): Distinct category ids this member has posted in.
        bio (Union[None, Unset, str]):
        display_name (Union[None, Unset, str]):
        slug (Union[None, Unset, str]):
        avatar_url (Union[None, Unset, str]):
    """

    customer_id: str
    role: str
    joined_at: str
    post_count: int
    active_category_ids: list[str]
    bio: None | Unset | str = UNSET
    display_name: None | Unset | str = UNSET
    slug: None | Unset | str = UNSET
    avatar_url: None | Unset | str = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        customer_id = self.customer_id

        role = self.role

        joined_at = self.joined_at

        post_count = self.post_count

        active_category_ids = self.active_category_ids

        bio: Unset | str | None
        if isinstance(self.bio, Unset):
            bio = UNSET
        else:
            bio = self.bio

        display_name: Unset | str | None
        if isinstance(self.display_name, Unset):
            display_name = UNSET
        else:
            display_name = self.display_name

        slug: Unset | str | None
        if isinstance(self.slug, Unset):
            slug = UNSET
        else:
            slug = self.slug

        avatar_url: Unset | str | None
        if isinstance(self.avatar_url, Unset):
            avatar_url = UNSET
        else:
            avatar_url = self.avatar_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "customerId": customer_id,
                "role": role,
                "joinedAt": joined_at,
                "postCount": post_count,
                "activeCategoryIds": active_category_ids,
            }
        )
        if bio is not UNSET:
            field_dict["bio"] = bio
        if display_name is not UNSET:
            field_dict["displayName"] = display_name
        if slug is not UNSET:
            field_dict["slug"] = slug
        if avatar_url is not UNSET:
            field_dict["avatarUrl"] = avatar_url

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        customer_id = d.pop("customerId")

        role = d.pop("role")

        joined_at = d.pop("joinedAt")

        post_count = d.pop("postCount")

        active_category_ids = cast(list[str], d.pop("activeCategoryIds"))

        def _parse_bio(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        bio = _parse_bio(d.pop("bio", UNSET))

        def _parse_display_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        display_name = _parse_display_name(d.pop("displayName", UNSET))

        def _parse_slug(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        slug = _parse_slug(d.pop("slug", UNSET))

        def _parse_avatar_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        avatar_url = _parse_avatar_url(d.pop("avatarUrl", UNSET))

        community_directory_entry = cls(
            customer_id=customer_id,
            role=role,
            joined_at=joined_at,
            post_count=post_count,
            active_category_ids=active_category_ids,
            bio=bio,
            display_name=display_name,
            slug=slug,
            avatar_url=avatar_url,
        )

        community_directory_entry.additional_properties = d
        return community_directory_entry

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
