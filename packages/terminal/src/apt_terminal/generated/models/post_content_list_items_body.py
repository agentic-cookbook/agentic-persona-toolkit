from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_content_list_items_body_value_type_1 import (
        PostContentListItemsBodyValueType1,
    )


T = TypeVar("T", bound="PostContentListItemsBody")


@_attrs_define
class PostContentListItemsBody:
    """
    Attributes:
        list_id (str):
        position (int):
        value (Union['PostContentListItemsBodyValueType1', None, bool, float, list[Any], str]):
        ecosystem_id (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    list_id: str
    position: int
    value: Union["PostContentListItemsBodyValueType1", None, bool, float, list[Any], str]
    ecosystem_id: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_content_list_items_body_value_type_1 import (
            PostContentListItemsBodyValueType1,
        )

        list_id = self.list_id

        position = self.position

        value: bool | dict[str, Any] | float | list[Any] | str | None
        if isinstance(self.value, PostContentListItemsBodyValueType1):
            value = self.value.to_dict()
        elif isinstance(self.value, list):
            value = self.value

        else:
            value = self.value

        ecosystem_id = self.ecosystem_id

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "listId": list_id,
                "position": position,
                "value": value,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_content_list_items_body_value_type_1 import (
            PostContentListItemsBodyValueType1,
        )

        d = dict(src_dict)
        list_id = d.pop("listId")

        position = d.pop("position")

        def _parse_value(
            data: object,
        ) -> Union["PostContentListItemsBodyValueType1", None, bool, float, list[Any], str]:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                value_type_1 = PostContentListItemsBodyValueType1.from_dict(data)

                return value_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                value_type_2 = cast(list[Any], data)

                return value_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union["PostContentListItemsBodyValueType1", None, bool, float, list[Any], str], data
            )

        value = _parse_value(d.pop("value"))

        ecosystem_id = d.pop("ecosystemId", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        post_content_list_items_body = cls(
            list_id=list_id,
            position=position,
            value=value,
            ecosystem_id=ecosystem_id,
            sync_txid=sync_txid,
        )

        return post_content_list_items_body
