from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="MarkdownCategoryNode")


@_attrs_define
class MarkdownCategoryNode:
    """
    Attributes:
        id (str):
        name (str):
        parent_id (Union[None, str]): The category this one sits under; null for a root. App-level convention — there is
            no FK, so a consumer folding the tree must tolerate a missing or cyclic parent.
        sort_order (int): Sibling order hint (0 unless set through the generic CRUD).
    """

    id: str
    name: str
    parent_id: None | str
    sort_order: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        name = self.name

        parent_id: None | str
        parent_id = self.parent_id

        sort_order = self.sort_order

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "name": name,
                "parentId": parent_id,
                "sortOrder": sort_order,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        name = d.pop("name")

        def _parse_parent_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        parent_id = _parse_parent_id(d.pop("parentId"))

        sort_order = d.pop("sortOrder")

        markdown_category_node = cls(
            id=id,
            name=name,
            parent_id=parent_id,
            sort_order=sort_order,
        )

        markdown_category_node.additional_properties = d
        return markdown_category_node

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
