from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_game_definitions_body_data_type_0_type_1 import (
        PostGameDefinitionsBodyDataType0Type1,
    )


T = TypeVar("T", bound="PostGameDefinitionsBody")


@_attrs_define
class PostGameDefinitionsBody:
    """
    Attributes:
        game_id (str):
        kind (str):
        key (str):
        name (str):
        ecosystem_id (Union[Unset, str]):
        description (Union[None, Unset, str]):
        status (Union[Unset, str]):
        sort_order (Union[Unset, int]):
        data (Union['PostGameDefinitionsBodyDataType0Type1', None, Unset, bool, float, list[Any], str]):
        sync_txid (Union[Unset, int]):
    """

    game_id: str
    kind: str
    key: str
    name: str
    ecosystem_id: Unset | str = UNSET
    description: None | Unset | str = UNSET
    status: Unset | str = UNSET
    sort_order: Unset | int = UNSET
    data: Union[
        "PostGameDefinitionsBodyDataType0Type1", None, Unset, bool, float, list[Any], str
    ] = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_game_definitions_body_data_type_0_type_1 import (
            PostGameDefinitionsBodyDataType0Type1,
        )

        game_id = self.game_id

        kind = self.kind

        key = self.key

        name = self.name

        ecosystem_id = self.ecosystem_id

        description: None | Unset | str
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        status = self.status

        sort_order = self.sort_order

        data: None | Unset | bool | dict[str, Any] | float | list[Any] | str
        if isinstance(self.data, Unset):
            data = UNSET
        elif isinstance(self.data, PostGameDefinitionsBodyDataType0Type1):
            data = self.data.to_dict()
        elif isinstance(self.data, list):
            data = self.data

        else:
            data = self.data

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "gameId": game_id,
                "kind": kind,
                "key": key,
                "name": name,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if description is not UNSET:
            field_dict["description"] = description
        if status is not UNSET:
            field_dict["status"] = status
        if sort_order is not UNSET:
            field_dict["sortOrder"] = sort_order
        if data is not UNSET:
            field_dict["data"] = data
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_game_definitions_body_data_type_0_type_1 import (
            PostGameDefinitionsBodyDataType0Type1,
        )

        d = dict(src_dict)
        game_id = d.pop("gameId")

        kind = d.pop("kind")

        key = d.pop("key")

        name = d.pop("name")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_description(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        description = _parse_description(d.pop("description", UNSET))

        status = d.pop("status", UNSET)

        sort_order = d.pop("sortOrder", UNSET)

        def _parse_data(
            data: object,
        ) -> Union[
            "PostGameDefinitionsBodyDataType0Type1", None, Unset, bool, float, list[Any], str
        ]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                data_type_0_type_1 = PostGameDefinitionsBodyDataType0Type1.from_dict(data)

                return data_type_0_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                data_type_0_type_2 = cast(list[Any], data)

                return data_type_0_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union[
                    "PostGameDefinitionsBodyDataType0Type1",
                    None,
                    Unset,
                    bool,
                    float,
                    list[Any],
                    str,
                ],
                data,
            )

        data = _parse_data(d.pop("data", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        post_game_definitions_body = cls(
            game_id=game_id,
            kind=kind,
            key=key,
            name=name,
            ecosystem_id=ecosystem_id,
            description=description,
            status=status,
            sort_order=sort_order,
            data=data,
            sync_txid=sync_txid,
        )

        return post_game_definitions_body
