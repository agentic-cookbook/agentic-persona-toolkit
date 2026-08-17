from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.put_integration_integration_audiences_id_body_raw_type_0_type_1 import (
        PutIntegrationIntegrationAudiencesIdBodyRawType0Type1,
    )


T = TypeVar("T", bound="PutIntegrationIntegrationAudiencesIdBody")


@_attrs_define
class PutIntegrationIntegrationAudiencesIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        connection_id (Union[Unset, str]):
        provider (Union[Unset, str]):
        external_id (Union[Unset, str]):
        name (Union[Unset, str]):
        member_count (Union[None, Unset, int]):
        raw (Union['PutIntegrationIntegrationAudiencesIdBodyRawType0Type1', None, Unset, bool, float, list[Any], str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    connection_id: Unset | str = UNSET
    provider: Unset | str = UNSET
    external_id: Unset | str = UNSET
    name: Unset | str = UNSET
    member_count: None | Unset | int = UNSET
    raw: Union[
        "PutIntegrationIntegrationAudiencesIdBodyRawType0Type1",
        None,
        Unset,
        bool,
        float,
        list[Any],
        str,
    ] = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_integration_integration_audiences_id_body_raw_type_0_type_1 import (
            PutIntegrationIntegrationAudiencesIdBodyRawType0Type1,
        )

        ecosystem_id = self.ecosystem_id

        connection_id = self.connection_id

        provider = self.provider

        external_id = self.external_id

        name = self.name

        member_count: None | Unset | int
        if isinstance(self.member_count, Unset):
            member_count = UNSET
        else:
            member_count = self.member_count

        raw: None | Unset | bool | dict[str, Any] | float | list[Any] | str
        if isinstance(self.raw, Unset):
            raw = UNSET
        elif isinstance(self.raw, PutIntegrationIntegrationAudiencesIdBodyRawType0Type1):
            raw = self.raw.to_dict()
        elif isinstance(self.raw, list):
            raw = self.raw

        else:
            raw = self.raw

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if connection_id is not UNSET:
            field_dict["connectionId"] = connection_id
        if provider is not UNSET:
            field_dict["provider"] = provider
        if external_id is not UNSET:
            field_dict["externalId"] = external_id
        if name is not UNSET:
            field_dict["name"] = name
        if member_count is not UNSET:
            field_dict["memberCount"] = member_count
        if raw is not UNSET:
            field_dict["raw"] = raw
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_integration_integration_audiences_id_body_raw_type_0_type_1 import (
            PutIntegrationIntegrationAudiencesIdBodyRawType0Type1,
        )

        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        connection_id = d.pop("connectionId", UNSET)

        provider = d.pop("provider", UNSET)

        external_id = d.pop("externalId", UNSET)

        name = d.pop("name", UNSET)

        def _parse_member_count(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        member_count = _parse_member_count(d.pop("memberCount", UNSET))

        def _parse_raw(
            data: object,
        ) -> Union[
            "PutIntegrationIntegrationAudiencesIdBodyRawType0Type1",
            None,
            Unset,
            bool,
            float,
            list[Any],
            str,
        ]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                raw_type_0_type_1 = PutIntegrationIntegrationAudiencesIdBodyRawType0Type1.from_dict(
                    data
                )

                return raw_type_0_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                raw_type_0_type_2 = cast(list[Any], data)

                return raw_type_0_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union[
                    "PutIntegrationIntegrationAudiencesIdBodyRawType0Type1",
                    None,
                    Unset,
                    bool,
                    float,
                    list[Any],
                    str,
                ],
                data,
            )

        raw = _parse_raw(d.pop("raw", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        put_integration_integration_audiences_id_body = cls(
            ecosystem_id=ecosystem_id,
            connection_id=connection_id,
            provider=provider,
            external_id=external_id,
            name=name,
            member_count=member_count,
            raw=raw,
            sync_txid=sync_txid,
        )

        return put_integration_integration_audiences_id_body
