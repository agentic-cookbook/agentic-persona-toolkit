from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostContentFeedbackBody")


@_attrs_define
class PostContentFeedbackBody:
    """
    Attributes:
        user_email (str):
        category (str):
        subject (str):
        body (str):
        platform (str):
        ecosystem_id (Union[Unset, str]):
        app_version (Union[Unset, str]):
        os_version (Union[Unset, str]):
        device_info (Union[Unset, str]):
        status (Union[Unset, str]):
        admin_notes (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    user_email: str
    category: str
    subject: str
    body: str
    platform: str
    ecosystem_id: Unset | str = UNSET
    app_version: Unset | str = UNSET
    os_version: Unset | str = UNSET
    device_info: Unset | str = UNSET
    status: Unset | str = UNSET
    admin_notes: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        user_email = self.user_email

        category = self.category

        subject = self.subject

        body = self.body

        platform = self.platform

        ecosystem_id = self.ecosystem_id

        app_version = self.app_version

        os_version = self.os_version

        device_info = self.device_info

        status = self.status

        admin_notes = self.admin_notes

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "userEmail": user_email,
                "category": category,
                "subject": subject,
                "body": body,
                "platform": platform,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if app_version is not UNSET:
            field_dict["appVersion"] = app_version
        if os_version is not UNSET:
            field_dict["osVersion"] = os_version
        if device_info is not UNSET:
            field_dict["deviceInfo"] = device_info
        if status is not UNSET:
            field_dict["status"] = status
        if admin_notes is not UNSET:
            field_dict["adminNotes"] = admin_notes
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        user_email = d.pop("userEmail")

        category = d.pop("category")

        subject = d.pop("subject")

        body = d.pop("body")

        platform = d.pop("platform")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        app_version = d.pop("appVersion", UNSET)

        os_version = d.pop("osVersion", UNSET)

        device_info = d.pop("deviceInfo", UNSET)

        status = d.pop("status", UNSET)

        admin_notes = d.pop("adminNotes", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        post_content_feedback_body = cls(
            user_email=user_email,
            category=category,
            subject=subject,
            body=body,
            platform=platform,
            ecosystem_id=ecosystem_id,
            app_version=app_version,
            os_version=os_version,
            device_info=device_info,
            status=status,
            admin_notes=admin_notes,
            sync_txid=sync_txid,
        )

        return post_content_feedback_body
