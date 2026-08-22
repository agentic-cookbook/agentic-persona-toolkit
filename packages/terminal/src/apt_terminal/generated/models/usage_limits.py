from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="UsageLimits")


@_attrs_define
class UsageLimits:
    """
    Attributes:
        quota_requests (Union[None, int]): Calls per period; null = uncapped
        quota_bytes (Union[None, int]): HTTP bytes per period; null = uncapped
        quota_tokens (Union[None, int]): LLM tokens per period; null = uncapped
        quota_cost_micros (Union[None, int]): Provider spend in µUSD per period; null = uncapped
        enforced (bool): Whether exceeding these limits refuses a request
    """

    quota_requests: None | int
    quota_bytes: None | int
    quota_tokens: None | int
    quota_cost_micros: None | int
    enforced: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        quota_requests: None | int
        quota_requests = self.quota_requests

        quota_bytes: None | int
        quota_bytes = self.quota_bytes

        quota_tokens: None | int
        quota_tokens = self.quota_tokens

        quota_cost_micros: None | int
        quota_cost_micros = self.quota_cost_micros

        enforced = self.enforced

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "quotaRequests": quota_requests,
                "quotaBytes": quota_bytes,
                "quotaTokens": quota_tokens,
                "quotaCostMicros": quota_cost_micros,
                "enforced": enforced,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_quota_requests(data: object) -> None | int:
            if data is None:
                return data
            return cast(None | int, data)

        quota_requests = _parse_quota_requests(d.pop("quotaRequests"))

        def _parse_quota_bytes(data: object) -> None | int:
            if data is None:
                return data
            return cast(None | int, data)

        quota_bytes = _parse_quota_bytes(d.pop("quotaBytes"))

        def _parse_quota_tokens(data: object) -> None | int:
            if data is None:
                return data
            return cast(None | int, data)

        quota_tokens = _parse_quota_tokens(d.pop("quotaTokens"))

        def _parse_quota_cost_micros(data: object) -> None | int:
            if data is None:
                return data
            return cast(None | int, data)

        quota_cost_micros = _parse_quota_cost_micros(d.pop("quotaCostMicros"))

        enforced = d.pop("enforced")

        usage_limits = cls(
            quota_requests=quota_requests,
            quota_bytes=quota_bytes,
            quota_tokens=quota_tokens,
            quota_cost_micros=quota_cost_micros,
            enforced=enforced,
        )

        usage_limits.additional_properties = d
        return usage_limits

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
