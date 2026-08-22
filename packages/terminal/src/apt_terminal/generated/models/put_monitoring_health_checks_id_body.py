from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutMonitoringHealthChecksIdBody")


@_attrs_define
class PutMonitoringHealthChecksIdBody:
    """
    Attributes:
        endpoint_id (Union[Unset, str]):
        status (Union[Unset, str]):
        response_time_ms (Union[None, Unset, int]):
        status_code (Union[None, Unset, int]):
        error_message (Union[None, Unset, str]):
        checked_at (Union[Unset, str]):
    """

    endpoint_id: Unset | str = UNSET
    status: Unset | str = UNSET
    response_time_ms: None | Unset | int = UNSET
    status_code: None | Unset | int = UNSET
    error_message: None | Unset | str = UNSET
    checked_at: Unset | str = UNSET

    def to_dict(self) -> dict[str, Any]:
        endpoint_id = self.endpoint_id

        status = self.status

        response_time_ms: None | Unset | int
        if isinstance(self.response_time_ms, Unset):
            response_time_ms = UNSET
        else:
            response_time_ms = self.response_time_ms

        status_code: None | Unset | int
        if isinstance(self.status_code, Unset):
            status_code = UNSET
        else:
            status_code = self.status_code

        error_message: None | Unset | str
        if isinstance(self.error_message, Unset):
            error_message = UNSET
        else:
            error_message = self.error_message

        checked_at = self.checked_at

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if endpoint_id is not UNSET:
            field_dict["endpointId"] = endpoint_id
        if status is not UNSET:
            field_dict["status"] = status
        if response_time_ms is not UNSET:
            field_dict["responseTimeMs"] = response_time_ms
        if status_code is not UNSET:
            field_dict["statusCode"] = status_code
        if error_message is not UNSET:
            field_dict["errorMessage"] = error_message
        if checked_at is not UNSET:
            field_dict["checkedAt"] = checked_at

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        endpoint_id = d.pop("endpointId", UNSET)

        status = d.pop("status", UNSET)

        def _parse_response_time_ms(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        response_time_ms = _parse_response_time_ms(d.pop("responseTimeMs", UNSET))

        def _parse_status_code(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        status_code = _parse_status_code(d.pop("statusCode", UNSET))

        def _parse_error_message(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        error_message = _parse_error_message(d.pop("errorMessage", UNSET))

        checked_at = d.pop("checkedAt", UNSET)

        put_monitoring_health_checks_id_body = cls(
            endpoint_id=endpoint_id,
            status=status,
            response_time_ms=response_time_ms,
            status_code=status_code,
            error_message=error_message,
            checked_at=checked_at,
        )

        return put_monitoring_health_checks_id_body
