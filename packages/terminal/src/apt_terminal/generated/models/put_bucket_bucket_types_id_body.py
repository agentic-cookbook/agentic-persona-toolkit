from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.put_bucket_bucket_types_id_body_metadata_type_0_type_1 import (
        PutBucketBucketTypesIdBodyMetadataType0Type1,
    )


T = TypeVar("T", bound="PutBucketBucketTypesIdBody")


@_attrs_define
class PutBucketBucketTypesIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        bucket_id (Union[Unset, str]):
        sql_table_name (Union[Unset, str]):
        name (Union[Unset, str]):
        description (Union[Unset, str]):
        ref_mode (Union[Unset, str]):
        metadata (Union['PutBucketBucketTypesIdBodyMetadataType0Type1', None, Unset, bool, float, list[Any], str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    bucket_id: Unset | str = UNSET
    sql_table_name: Unset | str = UNSET
    name: Unset | str = UNSET
    description: Unset | str = UNSET
    ref_mode: Unset | str = UNSET
    metadata: Union[
        "PutBucketBucketTypesIdBodyMetadataType0Type1", None, Unset, bool, float, list[Any], str
    ] = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_bucket_bucket_types_id_body_metadata_type_0_type_1 import (
            PutBucketBucketTypesIdBodyMetadataType0Type1,
        )

        ecosystem_id = self.ecosystem_id

        bucket_id = self.bucket_id

        sql_table_name = self.sql_table_name

        name = self.name

        description = self.description

        ref_mode = self.ref_mode

        metadata: Unset | bool | dict[str, Any] | float | list[Any] | str | None
        if isinstance(self.metadata, Unset):
            metadata = UNSET
        elif isinstance(self.metadata, PutBucketBucketTypesIdBodyMetadataType0Type1):
            metadata = self.metadata.to_dict()
        elif isinstance(self.metadata, list):
            metadata = self.metadata

        else:
            metadata = self.metadata

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if bucket_id is not UNSET:
            field_dict["bucketId"] = bucket_id
        if sql_table_name is not UNSET:
            field_dict["sqlTableName"] = sql_table_name
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if ref_mode is not UNSET:
            field_dict["refMode"] = ref_mode
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_bucket_bucket_types_id_body_metadata_type_0_type_1 import (
            PutBucketBucketTypesIdBodyMetadataType0Type1,
        )

        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        bucket_id = d.pop("bucketId", UNSET)

        sql_table_name = d.pop("sqlTableName", UNSET)

        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        ref_mode = d.pop("refMode", UNSET)

        def _parse_metadata(
            data: object,
        ) -> Union[
            "PutBucketBucketTypesIdBodyMetadataType0Type1", None, Unset, bool, float, list[Any], str
        ]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                metadata_type_0_type_1 = PutBucketBucketTypesIdBodyMetadataType0Type1.from_dict(
                    data
                )

                return metadata_type_0_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                metadata_type_0_type_2 = cast(list[Any], data)

                return metadata_type_0_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union[
                    "PutBucketBucketTypesIdBodyMetadataType0Type1",
                    None,
                    Unset,
                    bool,
                    float,
                    list[Any],
                    str,
                ],
                data,
            )

        metadata = _parse_metadata(d.pop("metadata", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        put_bucket_bucket_types_id_body = cls(
            ecosystem_id=ecosystem_id,
            bucket_id=bucket_id,
            sql_table_name=sql_table_name,
            name=name,
            description=description,
            ref_mode=ref_mode,
            metadata=metadata,
            sync_txid=sync_txid,
        )

        return put_bucket_bucket_types_id_body
