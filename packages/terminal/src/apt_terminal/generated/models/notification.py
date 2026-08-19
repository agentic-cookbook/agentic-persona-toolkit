from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.notification_status import NotificationStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.notification_data import NotificationData


T = TypeVar("T", bound="Notification")


@_attrs_define
class Notification:
    """
    Attributes:
        id (str):
        ecosystem_id (str):
        user_id (str):
        category (str):
        title (str):
        data (NotificationData):
        status (NotificationStatus):
        is_read (bool):
        created_at (str):
        updated_at (str):
        actor_id (Union[None, Unset, str]):
        entity_kind (Union[None, Unset, str]):
        entity_id (Union[None, Unset, str]):
        body (Union[None, Unset, str]):
        dedupe_key (Union[None, Unset, str]):
        read_at (Union[None, Unset, str]):
    """

    id: str
    ecosystem_id: str
    user_id: str
    category: str
    title: str
    data: "NotificationData"
    status: NotificationStatus
    is_read: bool
    created_at: str
    updated_at: str
    actor_id: None | Unset | str = UNSET
    entity_kind: None | Unset | str = UNSET
    entity_id: None | Unset | str = UNSET
    body: None | Unset | str = UNSET
    dedupe_key: None | Unset | str = UNSET
    read_at: None | Unset | str = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        ecosystem_id = self.ecosystem_id

        user_id = self.user_id

        category = self.category

        title = self.title

        data = self.data.to_dict()

        status = self.status.value

        is_read = self.is_read

        created_at = self.created_at

        updated_at = self.updated_at

        actor_id: Unset | str | None
        if isinstance(self.actor_id, Unset):
            actor_id = UNSET
        else:
            actor_id = self.actor_id

        entity_kind: Unset | str | None
        if isinstance(self.entity_kind, Unset):
            entity_kind = UNSET
        else:
            entity_kind = self.entity_kind

        entity_id: Unset | str | None
        if isinstance(self.entity_id, Unset):
            entity_id = UNSET
        else:
            entity_id = self.entity_id

        body: Unset | str | None
        if isinstance(self.body, Unset):
            body = UNSET
        else:
            body = self.body

        dedupe_key: Unset | str | None
        if isinstance(self.dedupe_key, Unset):
            dedupe_key = UNSET
        else:
            dedupe_key = self.dedupe_key

        read_at: Unset | str | None
        if isinstance(self.read_at, Unset):
            read_at = UNSET
        else:
            read_at = self.read_at

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "ecosystemId": ecosystem_id,
                "userId": user_id,
                "category": category,
                "title": title,
                "data": data,
                "status": status,
                "isRead": is_read,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )
        if actor_id is not UNSET:
            field_dict["actorId"] = actor_id
        if entity_kind is not UNSET:
            field_dict["entityKind"] = entity_kind
        if entity_id is not UNSET:
            field_dict["entityId"] = entity_id
        if body is not UNSET:
            field_dict["body"] = body
        if dedupe_key is not UNSET:
            field_dict["dedupeKey"] = dedupe_key
        if read_at is not UNSET:
            field_dict["readAt"] = read_at

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.notification_data import NotificationData

        d = dict(src_dict)
        id = d.pop("id")

        ecosystem_id = d.pop("ecosystemId")

        user_id = d.pop("userId")

        category = d.pop("category")

        title = d.pop("title")

        data = NotificationData.from_dict(d.pop("data"))

        status = NotificationStatus(d.pop("status"))

        is_read = d.pop("isRead")

        created_at = d.pop("createdAt")

        updated_at = d.pop("updatedAt")

        def _parse_actor_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        actor_id = _parse_actor_id(d.pop("actorId", UNSET))

        def _parse_entity_kind(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        entity_kind = _parse_entity_kind(d.pop("entityKind", UNSET))

        def _parse_entity_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        entity_id = _parse_entity_id(d.pop("entityId", UNSET))

        def _parse_body(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        body = _parse_body(d.pop("body", UNSET))

        def _parse_dedupe_key(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        dedupe_key = _parse_dedupe_key(d.pop("dedupeKey", UNSET))

        def _parse_read_at(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        read_at = _parse_read_at(d.pop("readAt", UNSET))

        notification = cls(
            id=id,
            ecosystem_id=ecosystem_id,
            user_id=user_id,
            category=category,
            title=title,
            data=data,
            status=status,
            is_read=is_read,
            created_at=created_at,
            updated_at=updated_at,
            actor_id=actor_id,
            entity_kind=entity_kind,
            entity_id=entity_id,
            body=body,
            dedupe_key=dedupe_key,
            read_at=read_at,
        )

        notification.additional_properties = d
        return notification

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
