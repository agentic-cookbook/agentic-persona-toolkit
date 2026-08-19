from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostContentUrlsBody")


@_attrs_define
class PostContentUrlsBody:
    """
    Attributes:
        original_url (str):
        canonical_url (str):
        canonical_url_hash (str):
        ecosystem_id (Union[Unset, str]):
        title (Union[None, Unset, str]):
        description (Union[None, Unset, str]):
        note (Union[None, Unset, str]):
        preview_storage_key (Union[None, Unset, str]):
        preview_url (Union[None, Unset, str]):
        preview_status (Union[Unset, str]):
        preview_error (Union[None, Unset, str]):
        preview_generated_at (Union[None, Unset, str]):
        preview_attempts (Union[Unset, int]):
        sync_txid (Union[Unset, int]):
    """

    original_url: str
    canonical_url: str
    canonical_url_hash: str
    ecosystem_id: Unset | str = UNSET
    title: None | Unset | str = UNSET
    description: None | Unset | str = UNSET
    note: None | Unset | str = UNSET
    preview_storage_key: None | Unset | str = UNSET
    preview_url: None | Unset | str = UNSET
    preview_status: Unset | str = UNSET
    preview_error: None | Unset | str = UNSET
    preview_generated_at: None | Unset | str = UNSET
    preview_attempts: Unset | int = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        original_url = self.original_url

        canonical_url = self.canonical_url

        canonical_url_hash = self.canonical_url_hash

        ecosystem_id = self.ecosystem_id

        title: Unset | str | None
        if isinstance(self.title, Unset):
            title = UNSET
        else:
            title = self.title

        description: Unset | str | None
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        note: Unset | str | None
        if isinstance(self.note, Unset):
            note = UNSET
        else:
            note = self.note

        preview_storage_key: Unset | str | None
        if isinstance(self.preview_storage_key, Unset):
            preview_storage_key = UNSET
        else:
            preview_storage_key = self.preview_storage_key

        preview_url: Unset | str | None
        if isinstance(self.preview_url, Unset):
            preview_url = UNSET
        else:
            preview_url = self.preview_url

        preview_status = self.preview_status

        preview_error: Unset | str | None
        if isinstance(self.preview_error, Unset):
            preview_error = UNSET
        else:
            preview_error = self.preview_error

        preview_generated_at: Unset | str | None
        if isinstance(self.preview_generated_at, Unset):
            preview_generated_at = UNSET
        else:
            preview_generated_at = self.preview_generated_at

        preview_attempts = self.preview_attempts

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "originalUrl": original_url,
                "canonicalUrl": canonical_url,
                "canonicalUrlHash": canonical_url_hash,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if title is not UNSET:
            field_dict["title"] = title
        if description is not UNSET:
            field_dict["description"] = description
        if note is not UNSET:
            field_dict["note"] = note
        if preview_storage_key is not UNSET:
            field_dict["previewStorageKey"] = preview_storage_key
        if preview_url is not UNSET:
            field_dict["previewUrl"] = preview_url
        if preview_status is not UNSET:
            field_dict["previewStatus"] = preview_status
        if preview_error is not UNSET:
            field_dict["previewError"] = preview_error
        if preview_generated_at is not UNSET:
            field_dict["previewGeneratedAt"] = preview_generated_at
        if preview_attempts is not UNSET:
            field_dict["previewAttempts"] = preview_attempts
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        original_url = d.pop("originalUrl")

        canonical_url = d.pop("canonicalUrl")

        canonical_url_hash = d.pop("canonicalUrlHash")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_title(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        title = _parse_title(d.pop("title", UNSET))

        def _parse_description(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        description = _parse_description(d.pop("description", UNSET))

        def _parse_note(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        note = _parse_note(d.pop("note", UNSET))

        def _parse_preview_storage_key(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        preview_storage_key = _parse_preview_storage_key(d.pop("previewStorageKey", UNSET))

        def _parse_preview_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        preview_url = _parse_preview_url(d.pop("previewUrl", UNSET))

        preview_status = d.pop("previewStatus", UNSET)

        def _parse_preview_error(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        preview_error = _parse_preview_error(d.pop("previewError", UNSET))

        def _parse_preview_generated_at(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        preview_generated_at = _parse_preview_generated_at(d.pop("previewGeneratedAt", UNSET))

        preview_attempts = d.pop("previewAttempts", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        post_content_urls_body = cls(
            original_url=original_url,
            canonical_url=canonical_url,
            canonical_url_hash=canonical_url_hash,
            ecosystem_id=ecosystem_id,
            title=title,
            description=description,
            note=note,
            preview_storage_key=preview_storage_key,
            preview_url=preview_url,
            preview_status=preview_status,
            preview_error=preview_error,
            preview_generated_at=preview_generated_at,
            preview_attempts=preview_attempts,
            sync_txid=sync_txid,
        )

        return post_content_urls_body
