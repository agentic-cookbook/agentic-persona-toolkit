from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostIntegrationIntegrationBookmarksBody")


@_attrs_define
class PostIntegrationIntegrationBookmarksBody:
    """
    Attributes:
        connection_id (str):
        external_id (str):
        source_provider (str):
        title (str):
        url (str):
        ecosystem_id (Union[Unset, str]):
        excerpt (Union[None, Unset, str]):
        note (Union[None, Unset, str]):
        tags (Union[None, Unset, str]):
        image_url (Union[None, Unset, str]):
        collection_id (Union[None, Unset, str]):
        collection_name (Union[None, Unset, str]):
        is_favorite (Union[Unset, bool]):
        external_created_at (Union[None, Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    connection_id: str
    external_id: str
    source_provider: str
    title: str
    url: str
    ecosystem_id: Unset | str = UNSET
    excerpt: None | Unset | str = UNSET
    note: None | Unset | str = UNSET
    tags: None | Unset | str = UNSET
    image_url: None | Unset | str = UNSET
    collection_id: None | Unset | str = UNSET
    collection_name: None | Unset | str = UNSET
    is_favorite: Unset | bool = UNSET
    external_created_at: None | Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        connection_id = self.connection_id

        external_id = self.external_id

        source_provider = self.source_provider

        title = self.title

        url = self.url

        ecosystem_id = self.ecosystem_id

        excerpt: Unset | str | None
        if isinstance(self.excerpt, Unset):
            excerpt = UNSET
        else:
            excerpt = self.excerpt

        note: Unset | str | None
        if isinstance(self.note, Unset):
            note = UNSET
        else:
            note = self.note

        tags: Unset | str | None
        if isinstance(self.tags, Unset):
            tags = UNSET
        else:
            tags = self.tags

        image_url: Unset | str | None
        if isinstance(self.image_url, Unset):
            image_url = UNSET
        else:
            image_url = self.image_url

        collection_id: Unset | str | None
        if isinstance(self.collection_id, Unset):
            collection_id = UNSET
        else:
            collection_id = self.collection_id

        collection_name: Unset | str | None
        if isinstance(self.collection_name, Unset):
            collection_name = UNSET
        else:
            collection_name = self.collection_name

        is_favorite = self.is_favorite

        external_created_at: Unset | str | None
        if isinstance(self.external_created_at, Unset):
            external_created_at = UNSET
        else:
            external_created_at = self.external_created_at

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "connectionId": connection_id,
                "externalId": external_id,
                "sourceProvider": source_provider,
                "title": title,
                "url": url,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if excerpt is not UNSET:
            field_dict["excerpt"] = excerpt
        if note is not UNSET:
            field_dict["note"] = note
        if tags is not UNSET:
            field_dict["tags"] = tags
        if image_url is not UNSET:
            field_dict["imageUrl"] = image_url
        if collection_id is not UNSET:
            field_dict["collectionId"] = collection_id
        if collection_name is not UNSET:
            field_dict["collectionName"] = collection_name
        if is_favorite is not UNSET:
            field_dict["isFavorite"] = is_favorite
        if external_created_at is not UNSET:
            field_dict["externalCreatedAt"] = external_created_at
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        connection_id = d.pop("connectionId")

        external_id = d.pop("externalId")

        source_provider = d.pop("sourceProvider")

        title = d.pop("title")

        url = d.pop("url")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_excerpt(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        excerpt = _parse_excerpt(d.pop("excerpt", UNSET))

        def _parse_note(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        note = _parse_note(d.pop("note", UNSET))

        def _parse_tags(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        tags = _parse_tags(d.pop("tags", UNSET))

        def _parse_image_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        image_url = _parse_image_url(d.pop("imageUrl", UNSET))

        def _parse_collection_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        collection_id = _parse_collection_id(d.pop("collectionId", UNSET))

        def _parse_collection_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        collection_name = _parse_collection_name(d.pop("collectionName", UNSET))

        is_favorite = d.pop("isFavorite", UNSET)

        def _parse_external_created_at(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        external_created_at = _parse_external_created_at(d.pop("externalCreatedAt", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        post_integration_integration_bookmarks_body = cls(
            connection_id=connection_id,
            external_id=external_id,
            source_provider=source_provider,
            title=title,
            url=url,
            ecosystem_id=ecosystem_id,
            excerpt=excerpt,
            note=note,
            tags=tags,
            image_url=image_url,
            collection_id=collection_id,
            collection_name=collection_name,
            is_favorite=is_favorite,
            external_created_at=external_created_at,
            sync_txid=sync_txid,
        )

        return post_integration_integration_bookmarks_body
