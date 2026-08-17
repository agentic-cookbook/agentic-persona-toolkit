from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostGamePlayersBody")


@_attrs_define
class PostGamePlayersBody:
    """
    Attributes:
        game_id (str):
        first_played_at (str):
        last_played_at (str):
        ecosystem_id (Union[Unset, str]):
        character_name (Union[None, Unset, str]):
        character_avatar_url (Union[None, Unset, str]):
        visibility (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    game_id: str
    first_played_at: str
    last_played_at: str
    ecosystem_id: Unset | str = UNSET
    character_name: None | Unset | str = UNSET
    character_avatar_url: None | Unset | str = UNSET
    visibility: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        game_id = self.game_id

        first_played_at = self.first_played_at

        last_played_at = self.last_played_at

        ecosystem_id = self.ecosystem_id

        character_name: None | Unset | str
        if isinstance(self.character_name, Unset):
            character_name = UNSET
        else:
            character_name = self.character_name

        character_avatar_url: None | Unset | str
        if isinstance(self.character_avatar_url, Unset):
            character_avatar_url = UNSET
        else:
            character_avatar_url = self.character_avatar_url

        visibility = self.visibility

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "gameId": game_id,
                "firstPlayedAt": first_played_at,
                "lastPlayedAt": last_played_at,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if character_name is not UNSET:
            field_dict["characterName"] = character_name
        if character_avatar_url is not UNSET:
            field_dict["characterAvatarUrl"] = character_avatar_url
        if visibility is not UNSET:
            field_dict["visibility"] = visibility
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        game_id = d.pop("gameId")

        first_played_at = d.pop("firstPlayedAt")

        last_played_at = d.pop("lastPlayedAt")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_character_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        character_name = _parse_character_name(d.pop("characterName", UNSET))

        def _parse_character_avatar_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        character_avatar_url = _parse_character_avatar_url(d.pop("characterAvatarUrl", UNSET))

        visibility = d.pop("visibility", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        post_game_players_body = cls(
            game_id=game_id,
            first_played_at=first_played_at,
            last_played_at=last_played_at,
            ecosystem_id=ecosystem_id,
            character_name=character_name,
            character_avatar_url=character_avatar_url,
            visibility=visibility,
            sync_txid=sync_txid,
        )

        return post_game_players_body
