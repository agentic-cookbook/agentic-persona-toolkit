from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostMonitoringSiteGroupsBody")


@_attrs_define
class PostMonitoringSiteGroupsBody:
    """
    Attributes:
        name (str):
        slug (str):
        description (Union[None, Unset, str]):
        retention_days (Union[Unset, int]):
        display_order (Union[Unset, int]):
    """

    name: str
    slug: str
    description: None | Unset | str = UNSET
    retention_days: Unset | int = UNSET
    display_order: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        slug = self.slug

        description: None | Unset | str
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        retention_days = self.retention_days

        display_order = self.display_order

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "name": name,
                "slug": slug,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description
        if retention_days is not UNSET:
            field_dict["retentionDays"] = retention_days
        if display_order is not UNSET:
            field_dict["displayOrder"] = display_order

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        slug = d.pop("slug")

        def _parse_description(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        description = _parse_description(d.pop("description", UNSET))

        retention_days = d.pop("retentionDays", UNSET)

        display_order = d.pop("displayOrder", UNSET)

        post_monitoring_site_groups_body = cls(
            name=name,
            slug=slug,
            description=description,
            retention_days=retention_days,
            display_order=display_order,
        )

        return post_monitoring_site_groups_body
