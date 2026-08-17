from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostContentCategoriesBody")


@_attrs_define
class PostContentCategoriesBody:
    """
    Attributes:
        name (str):
        ecosystem_id (Union[Unset, str]):
        description (Union[Unset, str]):
        color (Union[Unset, str]):
        icon (Union[Unset, str]):
        parent_id (Union[None, Unset, str]):
        sort_order (Union[Unset, int]):
        sync_txid (Union[Unset, int]):
    """

    name: str
    ecosystem_id: Unset | str = UNSET
    description: Unset | str = UNSET
    color: Unset | str = UNSET
    icon: Unset | str = UNSET
    parent_id: None | Unset | str = UNSET
    sort_order: Unset | int = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        ecosystem_id = self.ecosystem_id

        description = self.description

        color = self.color

        icon = self.icon

        parent_id: None | Unset | str
        if isinstance(self.parent_id, Unset):
            parent_id = UNSET
        else:
            parent_id = self.parent_id

        sort_order = self.sort_order

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "name": name,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if description is not UNSET:
            field_dict["description"] = description
        if color is not UNSET:
            field_dict["color"] = color
        if icon is not UNSET:
            field_dict["icon"] = icon
        if parent_id is not UNSET:
            field_dict["parentId"] = parent_id
        if sort_order is not UNSET:
            field_dict["sortOrder"] = sort_order
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        description = d.pop("description", UNSET)

        color = d.pop("color", UNSET)

        icon = d.pop("icon", UNSET)

        def _parse_parent_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        parent_id = _parse_parent_id(d.pop("parentId", UNSET))

        sort_order = d.pop("sortOrder", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        post_content_categories_body = cls(
            name=name,
            ecosystem_id=ecosystem_id,
            description=description,
            color=color,
            icon=icon,
            parent_id=parent_id,
            sort_order=sort_order,
            sync_txid=sync_txid,
        )

        return post_content_categories_body
