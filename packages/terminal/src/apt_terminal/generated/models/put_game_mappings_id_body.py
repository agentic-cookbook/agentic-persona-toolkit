from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutGameMappingsIdBody")


@_attrs_define
class PutGameMappingsIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        game_id (Union[Unset, str]):
        from_id (Union[Unset, str]):
        kind (Union[Unset, str]):
        to_id (Union[Unset, str]):
        amount (Union[Unset, int]):
        sort_order (Union[Unset, int]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    game_id: Unset | str = UNSET
    from_id: Unset | str = UNSET
    kind: Unset | str = UNSET
    to_id: Unset | str = UNSET
    amount: Unset | int = UNSET
    sort_order: Unset | int = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        game_id = self.game_id

        from_id = self.from_id

        kind = self.kind

        to_id = self.to_id

        amount = self.amount

        sort_order = self.sort_order

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if game_id is not UNSET:
            field_dict["gameId"] = game_id
        if from_id is not UNSET:
            field_dict["fromId"] = from_id
        if kind is not UNSET:
            field_dict["kind"] = kind
        if to_id is not UNSET:
            field_dict["toId"] = to_id
        if amount is not UNSET:
            field_dict["amount"] = amount
        if sort_order is not UNSET:
            field_dict["sortOrder"] = sort_order
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        game_id = d.pop("gameId", UNSET)

        from_id = d.pop("fromId", UNSET)

        kind = d.pop("kind", UNSET)

        to_id = d.pop("toId", UNSET)

        amount = d.pop("amount", UNSET)

        sort_order = d.pop("sortOrder", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        put_game_mappings_id_body = cls(
            ecosystem_id=ecosystem_id,
            game_id=game_id,
            from_id=from_id,
            kind=kind,
            to_id=to_id,
            amount=amount,
            sort_order=sort_order,
            sync_txid=sync_txid,
        )

        return put_game_mappings_id_body
