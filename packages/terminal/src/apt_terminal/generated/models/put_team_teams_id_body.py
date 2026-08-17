from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutTeamTeamsIdBody")


@_attrs_define
class PutTeamTeamsIdBody:
    """
    Attributes:
        owner_kind (Union[Unset, str]):
        owner_id (Union[Unset, str]):
        slug (Union[Unset, str]):
        name (Union[Unset, str]):
        description (Union[Unset, str]):
    """

    owner_kind: Unset | str = UNSET
    owner_id: Unset | str = UNSET
    slug: Unset | str = UNSET
    name: Unset | str = UNSET
    description: Unset | str = UNSET

    def to_dict(self) -> dict[str, Any]:
        owner_kind = self.owner_kind

        owner_id = self.owner_id

        slug = self.slug

        name = self.name

        description = self.description

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if owner_kind is not UNSET:
            field_dict["ownerKind"] = owner_kind
        if owner_id is not UNSET:
            field_dict["ownerId"] = owner_id
        if slug is not UNSET:
            field_dict["slug"] = slug
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        owner_kind = d.pop("ownerKind", UNSET)

        owner_id = d.pop("ownerId", UNSET)

        slug = d.pop("slug", UNSET)

        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        put_team_teams_id_body = cls(
            owner_kind=owner_kind,
            owner_id=owner_id,
            slug=slug,
            name=name,
            description=description,
        )

        return put_team_teams_id_body
