from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.eco_send_invites_body_email import EcoSendInvitesBodyEmail
    from ..models.eco_send_invites_body_sms import EcoSendInvitesBodySms


T = TypeVar("T", bound="EcoSendInvitesBody")


@_attrs_define
class EcoSendInvitesBody:
    """
    Attributes:
        pending_user_ids (list[str]):
        email (Union[Unset, EcoSendInvitesBodyEmail]):
        sms (Union[Unset, EcoSendInvitesBodySms]):
    """

    pending_user_ids: list[str]
    email: Union[Unset, "EcoSendInvitesBodyEmail"] = UNSET
    sms: Union[Unset, "EcoSendInvitesBodySms"] = UNSET
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
        from ..models.eco_send_invites_body_email import EcoSendInvitesBodyEmail
        from ..models.eco_send_invites_body_sms import EcoSendInvitesBodySms

        d = dict(src_dict)
        pending_user_ids = cast(list[str], d.pop("pendingUserIds"))

        _email = d.pop("email", UNSET)
        email: Unset | EcoSendInvitesBodyEmail
        if isinstance(_email, Unset):
            email = UNSET
        else:
            email = EcoSendInvitesBodyEmail.from_dict(_email)

        _sms = d.pop("sms", UNSET)
        sms: Unset | EcoSendInvitesBodySms
        if isinstance(_sms, Unset):
            sms = UNSET
        else:
            sms = EcoSendInvitesBodySms.from_dict(_sms)

        eco_send_invites_body = cls(
            pending_user_ids=pending_user_ids,
            email=email,
            sms=sms,
        )

        eco_send_invites_body.additional_properties = d
        return eco_send_invites_body

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
