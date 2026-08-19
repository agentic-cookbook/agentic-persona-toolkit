from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostIntegrationIntegrationPagesBody")


@_attrs_define
class PostIntegrationIntegrationPagesBody:
    """
    Attributes:
        connection_id (str):
        external_id (str):
        object_type (str):
        ecosystem_id (Union[Unset, str]):
        title (Union[Unset, str]):
        url (Union[None, Unset, str]):
        icon (Union[None, Unset, str]):
        parent_type (Union[None, Unset, str]):
        parent_id (Union[None, Unset, str]):
        is_archived (Union[Unset, bool]):
        last_edited_at (Union[None, Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    connection_id: str
    external_id: str
    object_type: str
    ecosystem_id: Unset | str = UNSET
    title: Unset | str = UNSET
    url: None | Unset | str = UNSET
    icon: None | Unset | str = UNSET
    parent_type: None | Unset | str = UNSET
    parent_id: None | Unset | str = UNSET
    is_archived: Unset | bool = UNSET
    last_edited_at: None | Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        connection_id = self.connection_id

        external_id = self.external_id

        object_type = self.object_type

        ecosystem_id = self.ecosystem_id

        title = self.title

        url: Unset | str | None
        if isinstance(self.url, Unset):
            url = UNSET
        else:
            url = self.url

        icon: Unset | str | None
        if isinstance(self.icon, Unset):
            icon = UNSET
        else:
            icon = self.icon

        parent_type: Unset | str | None
        if isinstance(self.parent_type, Unset):
            parent_type = UNSET
        else:
            parent_type = self.parent_type

        parent_id: Unset | str | None
        if isinstance(self.parent_id, Unset):
            parent_id = UNSET
        else:
            parent_id = self.parent_id

        is_archived = self.is_archived

        last_edited_at: Unset | str | None
        if isinstance(self.last_edited_at, Unset):
            last_edited_at = UNSET
        else:
            last_edited_at = self.last_edited_at

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "connectionId": connection_id,
                "externalId": external_id,
                "objectType": object_type,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if title is not UNSET:
            field_dict["title"] = title
        if url is not UNSET:
            field_dict["url"] = url
        if icon is not UNSET:
            field_dict["icon"] = icon
        if parent_type is not UNSET:
            field_dict["parentType"] = parent_type
        if parent_id is not UNSET:
            field_dict["parentId"] = parent_id
        if is_archived is not UNSET:
            field_dict["isArchived"] = is_archived
        if last_edited_at is not UNSET:
            field_dict["lastEditedAt"] = last_edited_at
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        connection_id = d.pop("connectionId")

        external_id = d.pop("externalId")

        object_type = d.pop("objectType")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        title = d.pop("title", UNSET)

        def _parse_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        url = _parse_url(d.pop("url", UNSET))

        def _parse_icon(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        icon = _parse_icon(d.pop("icon", UNSET))

        def _parse_parent_type(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        parent_type = _parse_parent_type(d.pop("parentType", UNSET))

        def _parse_parent_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        parent_id = _parse_parent_id(d.pop("parentId", UNSET))

        is_archived = d.pop("isArchived", UNSET)

        def _parse_last_edited_at(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        last_edited_at = _parse_last_edited_at(d.pop("lastEditedAt", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        post_integration_integration_pages_body = cls(
            connection_id=connection_id,
            external_id=external_id,
            object_type=object_type,
            ecosystem_id=ecosystem_id,
            title=title,
            url=url,
            icon=icon,
            parent_type=parent_type,
            parent_id=parent_id,
            is_archived=is_archived,
            last_edited_at=last_edited_at,
            sync_txid=sync_txid,
        )

        return post_integration_integration_pages_body
