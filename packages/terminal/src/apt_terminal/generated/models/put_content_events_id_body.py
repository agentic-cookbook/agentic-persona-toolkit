from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.put_content_events_id_body_payload_type_1 import (
        PutContentEventsIdBodyPayloadType1,
    )


T = TypeVar("T", bound="PutContentEventsIdBody")


@_attrs_define
class PutContentEventsIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        type_ (Union[Unset, str]):
        payload (Union['PutContentEventsIdBodyPayloadType1', None, Unset, bool, float, list[Any], str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    type_: Unset | str = UNSET
    payload: Union[
        "PutContentEventsIdBodyPayloadType1", None, Unset, bool, float, list[Any], str
    ] = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_content_events_id_body_payload_type_1 import (
            PutContentEventsIdBodyPayloadType1,
        )

        ecosystem_id = self.ecosystem_id

        type_ = self.type_

        payload: Unset | bool | dict[str, Any] | float | list[Any] | str | None
        if isinstance(self.payload, Unset):
            payload = UNSET
        elif isinstance(self.payload, PutContentEventsIdBodyPayloadType1):
            payload = self.payload.to_dict()
        elif isinstance(self.payload, list):
            payload = self.payload

        else:
            payload = self.payload

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if type_ is not UNSET:
            field_dict["type"] = type_
        if payload is not UNSET:
            field_dict["payload"] = payload
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_content_events_id_body_payload_type_1 import (
            PutContentEventsIdBodyPayloadType1,
        )

        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        type_ = d.pop("type", UNSET)

        def _parse_payload(
            data: object,
        ) -> Union["PutContentEventsIdBodyPayloadType1", None, Unset, bool, float, list[Any], str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                payload_type_1 = PutContentEventsIdBodyPayloadType1.from_dict(data)

                return payload_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                payload_type_2 = cast(list[Any], data)

                return payload_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union[
                    "PutContentEventsIdBodyPayloadType1", None, Unset, bool, float, list[Any], str
                ],
                data,
            )

        payload = _parse_payload(d.pop("payload", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        put_content_events_id_body = cls(
            ecosystem_id=ecosystem_id,
            type_=type_,
            payload=payload,
            sync_txid=sync_txid,
        )

        return put_content_events_id_body
