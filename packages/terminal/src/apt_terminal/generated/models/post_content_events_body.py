from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_content_events_body_payload_type_1 import PostContentEventsBodyPayloadType1


T = TypeVar("T", bound="PostContentEventsBody")


@_attrs_define
class PostContentEventsBody:
    """
    Attributes:
        type_ (str):
        payload (Union['PostContentEventsBodyPayloadType1', None, bool, float, list[Any], str]):
        ecosystem_id (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    type_: str
    payload: Union["PostContentEventsBodyPayloadType1", None, bool, float, list[Any], str]
    ecosystem_id: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_content_events_body_payload_type_1 import (
            PostContentEventsBodyPayloadType1,
        )

        type_ = self.type_

        payload: bool | dict[str, Any] | float | list[Any] | str | None
        if isinstance(self.payload, PostContentEventsBodyPayloadType1):
            payload = self.payload.to_dict()
        elif isinstance(self.payload, list):
            payload = self.payload

        else:
            payload = self.payload

        ecosystem_id = self.ecosystem_id

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "type": type_,
                "payload": payload,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_content_events_body_payload_type_1 import (
            PostContentEventsBodyPayloadType1,
        )

        d = dict(src_dict)
        type_ = d.pop("type")

        def _parse_payload(
            data: object,
        ) -> Union["PostContentEventsBodyPayloadType1", None, bool, float, list[Any], str]:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                payload_type_1 = PostContentEventsBodyPayloadType1.from_dict(data)

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
                Union["PostContentEventsBodyPayloadType1", None, bool, float, list[Any], str], data
            )

        payload = _parse_payload(d.pop("payload"))

        ecosystem_id = d.pop("ecosystemId", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        post_content_events_body = cls(
            type_=type_,
            payload=payload,
            ecosystem_id=ecosystem_id,
            sync_txid=sync_txid,
        )

        return post_content_events_body
