from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.send_invite_channel import SendInviteChannel


T = TypeVar("T", bound="SendInvitesBody")


@_attrs_define
class SendInvitesBody:
    """Names the people to invite and the channels to reach them on. At least one channel is required.

    Attributes:
        pending_user_ids (list[str]):
        email (Union[Unset, SendInviteChannel]): Send on this channel. `note` is added to the message body.
        sms (Union[Unset, SendInviteChannel]): Send on this channel. `note` is added to the message body.
    """

    pending_user_ids: list[str]
    email: Union[Unset, "SendInviteChannel"] = UNSET
    sms: Union[Unset, "SendInviteChannel"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        pending_user_ids = self.pending_user_ids

        email: Unset | dict[str, Any] = UNSET
        if not isinstance(self.email, Unset):
            email = self.email.to_dict()

        sms: Unset | dict[str, Any] = UNSET
        if not isinstance(self.sms, Unset):
            sms = self.sms.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "pendingUserIds": pending_user_ids,
            }
        )
        if email is not UNSET:
            field_dict["email"] = email
        if sms is not UNSET:
            field_dict["sms"] = sms

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.send_invite_channel import SendInviteChannel

        d = dict(src_dict)
        pending_user_ids = cast(list[str], d.pop("pendingUserIds"))

        _email = d.pop("email", UNSET)
        email: Unset | SendInviteChannel
        if isinstance(_email, Unset):
            email = UNSET
        else:
            email = SendInviteChannel.from_dict(_email)

        _sms = d.pop("sms", UNSET)
        sms: Unset | SendInviteChannel
        if isinstance(_sms, Unset):
            sms = UNSET
        else:
            sms = SendInviteChannel.from_dict(_sms)

        send_invites_body = cls(
            pending_user_ids=pending_user_ids,
            email=email,
            sms=sms,
        )

        send_invites_body.additional_properties = d
        return send_invites_body

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
