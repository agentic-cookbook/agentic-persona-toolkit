from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_integration_integration_audience_contacts_body_fields_type_0_type_1 import (
        PostIntegrationIntegrationAudienceContactsBodyFieldsType0Type1,
    )
    from ..models.post_integration_integration_audience_contacts_body_raw_type_0_type_1 import (
        PostIntegrationIntegrationAudienceContactsBodyRawType0Type1,
    )
    from ..models.post_integration_integration_audience_contacts_body_tags_type_0_type_1 import (
        PostIntegrationIntegrationAudienceContactsBodyTagsType0Type1,
    )


T = TypeVar("T", bound="PostIntegrationIntegrationAudienceContactsBody")


@_attrs_define
class PostIntegrationIntegrationAudienceContactsBody:
    """
    Attributes:
        connection_id (str):
        provider (str):
        audience_id (str):
        external_id (str):
        email (str):
        status (str):
        ecosystem_id (Union[Unset, str]):
        first_name (Union[None, Unset, str]):
        last_name (Union[None, Unset, str]):
        tags (Union['PostIntegrationIntegrationAudienceContactsBodyTagsType0Type1', None, Unset, bool, float, list[Any],
            str]):
        fields (Union['PostIntegrationIntegrationAudienceContactsBodyFieldsType0Type1', None, Unset, bool, float,
            list[Any], str]):
        subscribed_at (Union[None, Unset, str]):
        raw (Union['PostIntegrationIntegrationAudienceContactsBodyRawType0Type1', None, Unset, bool, float, list[Any],
            str]):
        sync_txid (Union[Unset, int]):
    """

    connection_id: str
    provider: str
    audience_id: str
    external_id: str
    email: str
    status: str
    ecosystem_id: Unset | str = UNSET
    first_name: None | Unset | str = UNSET
    last_name: None | Unset | str = UNSET
    tags: Union[
        "PostIntegrationIntegrationAudienceContactsBodyTagsType0Type1",
        None,
        Unset,
        bool,
        float,
        list[Any],
        str,
    ] = UNSET
    fields: Union[
        "PostIntegrationIntegrationAudienceContactsBodyFieldsType0Type1",
        None,
        Unset,
        bool,
        float,
        list[Any],
        str,
    ] = UNSET
    subscribed_at: None | Unset | str = UNSET
    raw: Union[
        "PostIntegrationIntegrationAudienceContactsBodyRawType0Type1",
        None,
        Unset,
        bool,
        float,
        list[Any],
        str,
    ] = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_integration_integration_audience_contacts_body_fields_type_0_type_1 import (
            PostIntegrationIntegrationAudienceContactsBodyFieldsType0Type1,
        )
        from ..models.post_integration_integration_audience_contacts_body_raw_type_0_type_1 import (
            PostIntegrationIntegrationAudienceContactsBodyRawType0Type1,
        )
        from ..models.post_integration_integration_audience_contacts_body_tags_type_0_type_1 import (
            PostIntegrationIntegrationAudienceContactsBodyTagsType0Type1,
        )

        connection_id = self.connection_id

        provider = self.provider

        audience_id = self.audience_id

        external_id = self.external_id

        email = self.email

        status = self.status

        ecosystem_id = self.ecosystem_id

        first_name: None | Unset | str
        if isinstance(self.first_name, Unset):
            first_name = UNSET
        else:
            first_name = self.first_name

        last_name: None | Unset | str
        if isinstance(self.last_name, Unset):
            last_name = UNSET
        else:
            last_name = self.last_name

        tags: None | Unset | bool | dict[str, Any] | float | list[Any] | str
        if isinstance(self.tags, Unset):
            tags = UNSET
        elif isinstance(self.tags, PostIntegrationIntegrationAudienceContactsBodyTagsType0Type1):
            tags = self.tags.to_dict()
        elif isinstance(self.tags, list):
            tags = self.tags

        else:
            tags = self.tags

        fields: None | Unset | bool | dict[str, Any] | float | list[Any] | str
        if isinstance(self.fields, Unset):
            fields = UNSET
        elif isinstance(
            self.fields, PostIntegrationIntegrationAudienceContactsBodyFieldsType0Type1
        ):
            fields = self.fields.to_dict()
        elif isinstance(self.fields, list):
            fields = self.fields

        else:
            fields = self.fields

        subscribed_at: None | Unset | str
        if isinstance(self.subscribed_at, Unset):
            subscribed_at = UNSET
        else:
            subscribed_at = self.subscribed_at

        raw: None | Unset | bool | dict[str, Any] | float | list[Any] | str
        if isinstance(self.raw, Unset):
            raw = UNSET
        elif isinstance(self.raw, PostIntegrationIntegrationAudienceContactsBodyRawType0Type1):
            raw = self.raw.to_dict()
        elif isinstance(self.raw, list):
            raw = self.raw

        else:
            raw = self.raw

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "connectionId": connection_id,
                "provider": provider,
                "audienceId": audience_id,
                "externalId": external_id,
                "email": email,
                "status": status,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if first_name is not UNSET:
            field_dict["firstName"] = first_name
        if last_name is not UNSET:
            field_dict["lastName"] = last_name
        if tags is not UNSET:
            field_dict["tags"] = tags
        if fields is not UNSET:
            field_dict["fields"] = fields
        if subscribed_at is not UNSET:
            field_dict["subscribedAt"] = subscribed_at
        if raw is not UNSET:
            field_dict["raw"] = raw
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_integration_integration_audience_contacts_body_fields_type_0_type_1 import (
            PostIntegrationIntegrationAudienceContactsBodyFieldsType0Type1,
        )
        from ..models.post_integration_integration_audience_contacts_body_raw_type_0_type_1 import (
            PostIntegrationIntegrationAudienceContactsBodyRawType0Type1,
        )
        from ..models.post_integration_integration_audience_contacts_body_tags_type_0_type_1 import (
            PostIntegrationIntegrationAudienceContactsBodyTagsType0Type1,
        )

        d = dict(src_dict)
        connection_id = d.pop("connectionId")

        provider = d.pop("provider")

        audience_id = d.pop("audienceId")

        external_id = d.pop("externalId")

        email = d.pop("email")

        status = d.pop("status")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_first_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        first_name = _parse_first_name(d.pop("firstName", UNSET))

        def _parse_last_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        last_name = _parse_last_name(d.pop("lastName", UNSET))

        def _parse_tags(
            data: object,
        ) -> Union[
            "PostIntegrationIntegrationAudienceContactsBodyTagsType0Type1",
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
                tags_type_0_type_1 = (
                    PostIntegrationIntegrationAudienceContactsBodyTagsType0Type1.from_dict(data)
                )

                return tags_type_0_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                tags_type_0_type_2 = cast(list[Any], data)

                return tags_type_0_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union[
                    "PostIntegrationIntegrationAudienceContactsBodyTagsType0Type1",
                    None,
                    Unset,
                    bool,
                    float,
                    list[Any],
                    str,
                ],
                data,
            )

        tags = _parse_tags(d.pop("tags", UNSET))

        def _parse_fields(
            data: object,
        ) -> Union[
            "PostIntegrationIntegrationAudienceContactsBodyFieldsType0Type1",
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
                fields_type_0_type_1 = (
                    PostIntegrationIntegrationAudienceContactsBodyFieldsType0Type1.from_dict(data)
                )

                return fields_type_0_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                fields_type_0_type_2 = cast(list[Any], data)

                return fields_type_0_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union[
                    "PostIntegrationIntegrationAudienceContactsBodyFieldsType0Type1",
                    None,
                    Unset,
                    bool,
                    float,
                    list[Any],
                    str,
                ],
                data,
            )

        fields = _parse_fields(d.pop("fields", UNSET))

        def _parse_subscribed_at(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        subscribed_at = _parse_subscribed_at(d.pop("subscribedAt", UNSET))

        def _parse_raw(
            data: object,
        ) -> Union[
            "PostIntegrationIntegrationAudienceContactsBodyRawType0Type1",
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
                    PostIntegrationIntegrationAudienceContactsBodyRawType0Type1.from_dict(data)
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
                    "PostIntegrationIntegrationAudienceContactsBodyRawType0Type1",
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

        post_integration_integration_audience_contacts_body = cls(
            connection_id=connection_id,
            provider=provider,
            audience_id=audience_id,
            external_id=external_id,
            email=email,
            status=status,
            ecosystem_id=ecosystem_id,
            first_name=first_name,
            last_name=last_name,
            tags=tags,
            fields=fields,
            subscribed_at=subscribed_at,
            raw=raw,
            sync_txid=sync_txid,
        )

        return post_integration_integration_audience_contacts_body
