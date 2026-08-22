from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostPersonalJobsBody")


@_attrs_define
class PostPersonalJobsBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        company (Union[Unset, str]):
        role (Union[Unset, str]):
        start_date (Union[Unset, str]):
        end_date (Union[None, Unset, str]):
        location (Union[Unset, str]):
        description (Union[Unset, str]):
        is_current (Union[Unset, bool]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    company: Unset | str = UNSET
    role: Unset | str = UNSET
    start_date: Unset | str = UNSET
    end_date: None | Unset | str = UNSET
    location: Unset | str = UNSET
    description: Unset | str = UNSET
    is_current: Unset | bool = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        company = self.company

        role = self.role

        start_date = self.start_date

        end_date: None | Unset | str
        if isinstance(self.end_date, Unset):
            end_date = UNSET
        else:
            end_date = self.end_date

        location = self.location

        description = self.description

        is_current = self.is_current

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if company is not UNSET:
            field_dict["company"] = company
        if role is not UNSET:
            field_dict["role"] = role
        if start_date is not UNSET:
            field_dict["startDate"] = start_date
        if end_date is not UNSET:
            field_dict["endDate"] = end_date
        if location is not UNSET:
            field_dict["location"] = location
        if description is not UNSET:
            field_dict["description"] = description
        if is_current is not UNSET:
            field_dict["isCurrent"] = is_current
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        company = d.pop("company", UNSET)

        role = d.pop("role", UNSET)

        start_date = d.pop("startDate", UNSET)

        def _parse_end_date(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        end_date = _parse_end_date(d.pop("endDate", UNSET))

        location = d.pop("location", UNSET)

        description = d.pop("description", UNSET)

        is_current = d.pop("isCurrent", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        post_personal_jobs_body = cls(
            ecosystem_id=ecosystem_id,
            company=company,
            role=role,
            start_date=start_date,
            end_date=end_date,
            location=location,
            description=description,
            is_current=is_current,
            sync_txid=sync_txid,
        )

        return post_personal_jobs_body
