from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutPersonalEducationIdBody")


@_attrs_define
class PutPersonalEducationIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        institution (Union[Unset, str]):
        degree (Union[Unset, str]):
        field_of_study (Union[Unset, str]):
        start_date (Union[Unset, str]):
        end_date (Union[None, Unset, str]):
        location (Union[Unset, str]):
        description (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    institution: Unset | str = UNSET
    degree: Unset | str = UNSET
    field_of_study: Unset | str = UNSET
    start_date: Unset | str = UNSET
    end_date: None | Unset | str = UNSET
    location: Unset | str = UNSET
    description: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        institution = self.institution

        degree = self.degree

        field_of_study = self.field_of_study

        start_date = self.start_date

        end_date: Unset | str | None
        if isinstance(self.end_date, Unset):
            end_date = UNSET
        else:
            end_date = self.end_date

        location = self.location

        description = self.description

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if institution is not UNSET:
            field_dict["institution"] = institution
        if degree is not UNSET:
            field_dict["degree"] = degree
        if field_of_study is not UNSET:
            field_dict["fieldOfStudy"] = field_of_study
        if start_date is not UNSET:
            field_dict["startDate"] = start_date
        if end_date is not UNSET:
            field_dict["endDate"] = end_date
        if location is not UNSET:
            field_dict["location"] = location
        if description is not UNSET:
            field_dict["description"] = description
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        institution = d.pop("institution", UNSET)

        degree = d.pop("degree", UNSET)

        field_of_study = d.pop("fieldOfStudy", UNSET)

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

        sync_txid = d.pop("syncTxid", UNSET)

        put_personal_education_id_body = cls(
            ecosystem_id=ecosystem_id,
            institution=institution,
            degree=degree,
            field_of_study=field_of_study,
            start_date=start_date,
            end_date=end_date,
            location=location,
            description=description,
            sync_txid=sync_txid,
        )

        return put_personal_education_id_body
