from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.put_integration_integration_campaign_stats_id_body_raw_type_0_type_1 import (
        PutIntegrationIntegrationCampaignStatsIdBodyRawType0Type1,
    )


T = TypeVar("T", bound="PutIntegrationIntegrationCampaignStatsIdBody")


@_attrs_define
class PutIntegrationIntegrationCampaignStatsIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        connection_id (Union[Unset, str]):
        provider (Union[Unset, str]):
        audience_id (Union[Unset, str]):
        external_id (Union[Unset, str]):
        name (Union[None, Unset, str]):
        subject (Union[None, Unset, str]):
        status (Union[None, Unset, str]):
        sent_at (Union[None, Unset, str]):
        recipients (Union[None, Unset, int]):
        opens (Union[None, Unset, int]):
        unique_opens (Union[None, Unset, int]):
        clicks (Union[None, Unset, int]):
        unique_clicks (Union[None, Unset, int]):
        bounces (Union[None, Unset, int]):
        unsubscribes (Union[None, Unset, int]):
        raw (Union['PutIntegrationIntegrationCampaignStatsIdBodyRawType0Type1', None, Unset, bool, float, list[Any],
            str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    connection_id: Unset | str = UNSET
    provider: Unset | str = UNSET
    audience_id: Unset | str = UNSET
    external_id: Unset | str = UNSET
    name: None | Unset | str = UNSET
    subject: None | Unset | str = UNSET
    status: None | Unset | str = UNSET
    sent_at: None | Unset | str = UNSET
    recipients: None | Unset | int = UNSET
    opens: None | Unset | int = UNSET
    unique_opens: None | Unset | int = UNSET
    clicks: None | Unset | int = UNSET
    unique_clicks: None | Unset | int = UNSET
    bounces: None | Unset | int = UNSET
    unsubscribes: None | Unset | int = UNSET
    raw: Union[
        "PutIntegrationIntegrationCampaignStatsIdBodyRawType0Type1",
        None,
        Unset,
        bool,
        float,
        list[Any],
        str,
    ] = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_integration_integration_campaign_stats_id_body_raw_type_0_type_1 import (
            PutIntegrationIntegrationCampaignStatsIdBodyRawType0Type1,
        )

        ecosystem_id = self.ecosystem_id

        connection_id = self.connection_id

        provider = self.provider

        audience_id = self.audience_id

        external_id = self.external_id

        name: Unset | str | None
        if isinstance(self.name, Unset):
            name = UNSET
        else:
            name = self.name

        subject: Unset | str | None
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        status: Unset | str | None
        if isinstance(self.status, Unset):
            status = UNSET
        else:
            status = self.status

        sent_at: Unset | str | None
        if isinstance(self.sent_at, Unset):
            sent_at = UNSET
        else:
            sent_at = self.sent_at

        recipients: Unset | int | None
        if isinstance(self.recipients, Unset):
            recipients = UNSET
        else:
            recipients = self.recipients

        opens: Unset | int | None
        if isinstance(self.opens, Unset):
            opens = UNSET
        else:
            opens = self.opens

        unique_opens: Unset | int | None
        if isinstance(self.unique_opens, Unset):
            unique_opens = UNSET
        else:
            unique_opens = self.unique_opens

        clicks: Unset | int | None
        if isinstance(self.clicks, Unset):
            clicks = UNSET
        else:
            clicks = self.clicks

        unique_clicks: Unset | int | None
        if isinstance(self.unique_clicks, Unset):
            unique_clicks = UNSET
        else:
            unique_clicks = self.unique_clicks

        bounces: Unset | int | None
        if isinstance(self.bounces, Unset):
            bounces = UNSET
        else:
            bounces = self.bounces

        unsubscribes: Unset | int | None
        if isinstance(self.unsubscribes, Unset):
            unsubscribes = UNSET
        else:
            unsubscribes = self.unsubscribes

        raw: Unset | bool | dict[str, Any] | float | list[Any] | str | None
        if isinstance(self.raw, Unset):
            raw = UNSET
        elif isinstance(self.raw, PutIntegrationIntegrationCampaignStatsIdBodyRawType0Type1):
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
        if audience_id is not UNSET:
            field_dict["audienceId"] = audience_id
        if external_id is not UNSET:
            field_dict["externalId"] = external_id
        if name is not UNSET:
            field_dict["name"] = name
        if subject is not UNSET:
            field_dict["subject"] = subject
        if status is not UNSET:
            field_dict["status"] = status
        if sent_at is not UNSET:
            field_dict["sentAt"] = sent_at
        if recipients is not UNSET:
            field_dict["recipients"] = recipients
        if opens is not UNSET:
            field_dict["opens"] = opens
        if unique_opens is not UNSET:
            field_dict["uniqueOpens"] = unique_opens
        if clicks is not UNSET:
            field_dict["clicks"] = clicks
        if unique_clicks is not UNSET:
            field_dict["uniqueClicks"] = unique_clicks
        if bounces is not UNSET:
            field_dict["bounces"] = bounces
        if unsubscribes is not UNSET:
            field_dict["unsubscribes"] = unsubscribes
        if raw is not UNSET:
            field_dict["raw"] = raw
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_integration_integration_campaign_stats_id_body_raw_type_0_type_1 import (
            PutIntegrationIntegrationCampaignStatsIdBodyRawType0Type1,
        )

        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        connection_id = d.pop("connectionId", UNSET)

        provider = d.pop("provider", UNSET)

        audience_id = d.pop("audienceId", UNSET)

        external_id = d.pop("externalId", UNSET)

        def _parse_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        name = _parse_name(d.pop("name", UNSET))

        def _parse_subject(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        subject = _parse_subject(d.pop("subject", UNSET))

        def _parse_status(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        status = _parse_status(d.pop("status", UNSET))

        def _parse_sent_at(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        sent_at = _parse_sent_at(d.pop("sentAt", UNSET))

        def _parse_recipients(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        recipients = _parse_recipients(d.pop("recipients", UNSET))

        def _parse_opens(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        opens = _parse_opens(d.pop("opens", UNSET))

        def _parse_unique_opens(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        unique_opens = _parse_unique_opens(d.pop("uniqueOpens", UNSET))

        def _parse_clicks(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        clicks = _parse_clicks(d.pop("clicks", UNSET))

        def _parse_unique_clicks(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        unique_clicks = _parse_unique_clicks(d.pop("uniqueClicks", UNSET))

        def _parse_bounces(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        bounces = _parse_bounces(d.pop("bounces", UNSET))

        def _parse_unsubscribes(data: object) -> None | Unset | int:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | int, data)

        unsubscribes = _parse_unsubscribes(d.pop("unsubscribes", UNSET))

        def _parse_raw(
            data: object,
        ) -> Union[
            "PutIntegrationIntegrationCampaignStatsIdBodyRawType0Type1",
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
                raw_type_0_type_1 = (
                    PutIntegrationIntegrationCampaignStatsIdBodyRawType0Type1.from_dict(data)
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
                    "PutIntegrationIntegrationCampaignStatsIdBodyRawType0Type1",
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

        put_integration_integration_campaign_stats_id_body = cls(
            ecosystem_id=ecosystem_id,
            connection_id=connection_id,
            provider=provider,
            audience_id=audience_id,
            external_id=external_id,
            name=name,
            subject=subject,
            status=status,
            sent_at=sent_at,
            recipients=recipients,
            opens=opens,
            unique_opens=unique_opens,
            clicks=clicks,
            unique_clicks=unique_clicks,
            bounces=bounces,
            unsubscribes=unsubscribes,
            raw=raw,
            sync_txid=sync_txid,
        )

        return put_integration_integration_campaign_stats_id_body
