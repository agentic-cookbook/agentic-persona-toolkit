from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutIntegrationIntegrationMediaItemsIdBody")


@_attrs_define
class PutIntegrationIntegrationMediaItemsIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        connection_id (Union[Unset, str]):
        external_id (Union[Unset, str]):
        source_provider (Union[Unset, str]):
        media_type (Union[Unset, str]):
        title (Union[Unset, str]):
        artist (Union[None, Unset, str]):
        album (Union[None, Unset, str]):
        image_url (Union[None, Unset, str]):
        external_url (Union[None, Unset, str]):
        duration_ms (Union[None, Unset, int]):
        popularity (Union[None, Unset, int]):
        is_saved (Union[Unset, bool]):
        last_played_at (Union[None, Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    connection_id: Unset | str = UNSET
    external_id: Unset | str = UNSET
    source_provider: Unset | str = UNSET
    media_type: Unset | str = UNSET
    title: Unset | str = UNSET
    artist: None | Unset | str = UNSET
    album: None | Unset | str = UNSET
    image_url: None | Unset | str = UNSET
    external_url: None | Unset | str = UNSET
    duration_ms: None | Unset | int = UNSET
    popularity: None | Unset | int = UNSET
    is_saved: Unset | bool = UNSET
    last_played_at: None | Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        connection_id = self.connection_id

        external_id = self.external_id

        source_provider = self.source_provider

        media_type = self.media_type

        title = self.title

        artist: Unset | str | None
        if isinstance(self.artist, Unset):
            artist = UNSET
        else:
            artist = self.artist

        album: Unset | str | None
        if isinstance(self.album, Unset):
            album = UNSET
        else:
            album = self.album

        image_url: Unset | str | None
        if isinstance(self.image_url, Unset):
            image_url = UNSET
        else:
            image_url = self.image_url

        external_url: Unset | str | None
        if isinstance(self.external_url, Unset):
            external_url = UNSET
        else:
            external_url = self.external_url

        duration_ms: Unset | int | None
        if isinstance(self.duration_ms, Unset):
            duration_ms = UNSET
        else:
            duration_ms = self.duration_ms

        popularity: Unset | int | None
        if isinstance(self.popularity, Unset):
            popularity = UNSET
        else:
            popularity = self.popularity

        is_saved = self.is_saved

        last_played_at: Unset | str | None
        if isinstance(self.last_played_at, Unset):
            last_played_at = UNSET
        else:
            last_played_at = self.last_played_at

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if connection_id is not UNSET:
            field_dict["connectionId"] = connection_id
        if external_id is not UNSET:
            field_dict["externalId"] = external_id
        if source_provider is not UNSET:
            field_dict["sourceProvider"] = source_provider
        if media_type is not UNSET:
            field_dict["mediaType"] = media_type
        if title is not UNSET:
            field_dict["title"] = title
        if artist is not UNSET:
            field_dict["artist"] = artist
        if album is not UNSET:
            field_dict["album"] = album
        if image_url is not UNSET:
            field_dict["imageUrl"] = image_url
        if external_url is not UNSET:
            field_dict["externalUrl"] = external_url
        if duration_ms is not UNSET:
            field_dict["durationMs"] = duration_ms
        if popularity is not UNSET:
            field_dict["popularity"] = popularity
        if is_saved is not UNSET:
            field_dict["isSaved"] = is_saved
        if last_played_at is not UNSET:
            field_dict["lastPlayedAt"] = last_played_at
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        connection_id = d.pop("connectionId", UNSET)

        external_id = d.pop("externalId", UNSET)

        source_provider = d.pop("sourceProvider", UNSET)

        media_type = d.pop("mediaType", UNSET)

        title = d.pop("title", UNSET)

        def _parse_artist(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        artist = _parse_artist(d.pop("artist", UNSET))

        def _parse_album(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        album = _parse_album(d.pop("album", UNSET))

        def _parse_image_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        image_url = _parse_image_url(d.pop("imageUrl", UNSET))

        def _parse_external_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        external_url = _parse_external_url(d.pop("externalUrl", UNSET))

        def _parse_duration_ms(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        duration_ms = _parse_duration_ms(d.pop("durationMs", UNSET))

        def _parse_popularity(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        popularity = _parse_popularity(d.pop("popularity", UNSET))

        is_saved = d.pop("isSaved", UNSET)

        def _parse_last_played_at(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        last_played_at = _parse_last_played_at(d.pop("lastPlayedAt", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        put_integration_integration_media_items_id_body = cls(
            ecosystem_id=ecosystem_id,
            connection_id=connection_id,
            external_id=external_id,
            source_provider=source_provider,
            media_type=media_type,
            title=title,
            artist=artist,
            album=album,
            image_url=image_url,
            external_url=external_url,
            duration_ms=duration_ms,
            popularity=popularity,
            is_saved=is_saved,
            last_played_at=last_played_at,
            sync_txid=sync_txid,
        )

        return put_integration_integration_media_items_id_body
