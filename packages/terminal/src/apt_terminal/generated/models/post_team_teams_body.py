from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostTeamTeamsBody")


@_attrs_define
class PostTeamTeamsBody:
    """
    Attributes:
        slug (str):
        name (str):
        owner_kind (Union[Unset, str]):
        owner_id (Union[Unset, str]):
        description (Union[Unset, str]):
    """

    slug: str
    name: str
    owner_kind: Unset | str = UNSET
    owner_id: Unset | str = UNSET
    description: Unset | str = UNSET

    def to_dict(self) -> dict[str, Any]:
        slug = self.slug

        name = self.name

        owner_kind = self.owner_kind

        owner_id = self.owner_id

        description = self.description

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "slug": slug,
                "name": name,
            }
        )
        if owner_kind is not UNSET:
            field_dict["ownerKind"] = owner_kind
        if owner_id is not UNSET:
            field_dict["ownerId"] = owner_id
        if description is not UNSET:
            field_dict["description"] = description

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        slug = d.pop("slug")

        name = d.pop("name")

        owner_kind = d.pop("ownerKind", UNSET)

        owner_id = d.pop("ownerId", UNSET)

        description = d.pop("description", UNSET)

        post_team_teams_body = cls(
            slug=slug,
            name=name,
            owner_kind=owner_kind,
            owner_id=owner_id,
            description=description,
        )

        return post_team_teams_body
