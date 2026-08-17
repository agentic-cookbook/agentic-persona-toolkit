from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutMonitoringEndpointsIdBody")


@_attrs_define
class PutMonitoringEndpointsIdBody:
    """
    Attributes:
        site_id (Union[Unset, str]):
        kind (Union[Unset, str]):
        url (Union[Unset, str]):
        expected_status (Union[Unset, int]):
        expected_body_contains (Union[None, Unset, str]):
        timeout_ms (Union[Unset, int]):
        degraded_threshold_ms (Union[Unset, int]):
        check_interval_seconds (Union[Unset, int]):
        is_active (Union[Unset, bool]):
    """

    site_id: Unset | str = UNSET
    kind: Unset | str = UNSET
    url: Unset | str = UNSET
    expected_status: Unset | int = UNSET
    expected_body_contains: None | Unset | str = UNSET
    timeout_ms: Unset | int = UNSET
    degraded_threshold_ms: Unset | int = UNSET
    check_interval_seconds: Unset | int = UNSET
    is_active: Unset | bool = UNSET

    def to_dict(self) -> dict[str, Any]:
        site_id = self.site_id

        kind = self.kind

        url = self.url

        expected_status = self.expected_status

        expected_body_contains: None | Unset | str
        if isinstance(self.expected_body_contains, Unset):
            expected_body_contains = UNSET
        else:
            expected_body_contains = self.expected_body_contains

        timeout_ms = self.timeout_ms

        degraded_threshold_ms = self.degraded_threshold_ms

        check_interval_seconds = self.check_interval_seconds

        is_active = self.is_active

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if site_id is not UNSET:
            field_dict["siteId"] = site_id
        if kind is not UNSET:
            field_dict["kind"] = kind
        if url is not UNSET:
            field_dict["url"] = url
        if expected_status is not UNSET:
            field_dict["expectedStatus"] = expected_status
        if expected_body_contains is not UNSET:
            field_dict["expectedBodyContains"] = expected_body_contains
        if timeout_ms is not UNSET:
            field_dict["timeoutMs"] = timeout_ms
        if degraded_threshold_ms is not UNSET:
            field_dict["degradedThresholdMs"] = degraded_threshold_ms
        if check_interval_seconds is not UNSET:
            field_dict["checkIntervalSeconds"] = check_interval_seconds
        if is_active is not UNSET:
            field_dict["isActive"] = is_active

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        site_id = d.pop("siteId", UNSET)

        kind = d.pop("kind", UNSET)

        url = d.pop("url", UNSET)

        expected_status = d.pop("expectedStatus", UNSET)

        def _parse_expected_body_contains(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        expected_body_contains = _parse_expected_body_contains(d.pop("expectedBodyContains", UNSET))

        timeout_ms = d.pop("timeoutMs", UNSET)

        degraded_threshold_ms = d.pop("degradedThresholdMs", UNSET)

        check_interval_seconds = d.pop("checkIntervalSeconds", UNSET)

        is_active = d.pop("isActive", UNSET)

        put_monitoring_endpoints_id_body = cls(
            site_id=site_id,
            kind=kind,
            url=url,
            expected_status=expected_status,
            expected_body_contains=expected_body_contains,
            timeout_ms=timeout_ms,
            degraded_threshold_ms=degraded_threshold_ms,
            check_interval_seconds=check_interval_seconds,
            is_active=is_active,
        )

        return put_monitoring_endpoints_id_body
