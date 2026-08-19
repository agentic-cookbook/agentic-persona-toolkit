from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutSystemAuditEventsIdBody")


@_attrs_define
class PutSystemAuditEventsIdBody:
    """
    Attributes:
        ecosystem_id (Union[None, Unset, str]):
        developer_id (Union[None, Unset, str]):
        actor_user_id (Union[None, Unset, str]):
        event_type (Union[Unset, str]):
        payload (Union[Unset, str]):
        ip_address (Union[Unset, str]):
        user_agent (Union[Unset, str]):
    """

    ecosystem_id: None | Unset | str = UNSET
    developer_id: None | Unset | str = UNSET
    actor_user_id: None | Unset | str = UNSET
    event_type: Unset | str = UNSET
    payload: Unset | str = UNSET
    ip_address: Unset | str = UNSET
    user_agent: Unset | str = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id: Unset | str | None
        if isinstance(self.ecosystem_id, Unset):
            ecosystem_id = UNSET
        else:
            ecosystem_id = self.ecosystem_id

        developer_id: Unset | str | None
        if isinstance(self.developer_id, Unset):
            developer_id = UNSET
        else:
            developer_id = self.developer_id

        actor_user_id: Unset | str | None
        if isinstance(self.actor_user_id, Unset):
            actor_user_id = UNSET
        else:
            actor_user_id = self.actor_user_id

        event_type = self.event_type

        payload = self.payload

        ip_address = self.ip_address

        user_agent = self.user_agent

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if developer_id is not UNSET:
            field_dict["developerId"] = developer_id
        if actor_user_id is not UNSET:
            field_dict["actorUserId"] = actor_user_id
        if event_type is not UNSET:
            field_dict["eventType"] = event_type
        if payload is not UNSET:
            field_dict["payload"] = payload
        if ip_address is not UNSET:
            field_dict["ipAddress"] = ip_address
        if user_agent is not UNSET:
            field_dict["userAgent"] = user_agent

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_ecosystem_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        ecosystem_id = _parse_ecosystem_id(d.pop("ecosystemId", UNSET))

        def _parse_developer_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        developer_id = _parse_developer_id(d.pop("developerId", UNSET))

        def _parse_actor_user_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        actor_user_id = _parse_actor_user_id(d.pop("actorUserId", UNSET))

        event_type = d.pop("eventType", UNSET)

        payload = d.pop("payload", UNSET)

        ip_address = d.pop("ipAddress", UNSET)

        user_agent = d.pop("userAgent", UNSET)

        put_system_audit_events_id_body = cls(
            ecosystem_id=ecosystem_id,
            developer_id=developer_id,
            actor_user_id=actor_user_id,
            event_type=event_type,
            payload=payload,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return put_system_audit_events_id_body
