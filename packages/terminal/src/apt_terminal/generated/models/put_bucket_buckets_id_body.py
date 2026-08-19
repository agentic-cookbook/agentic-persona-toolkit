from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.put_bucket_buckets_id_body_metadata_type_0_type_1 import (
        PutBucketBucketsIdBodyMetadataType0Type1,
    )


T = TypeVar("T", bound="PutBucketBucketsIdBody")


@_attrs_define
class PutBucketBucketsIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        parent_id (Union[None, Unset, str]):
        name (Union[Unset, str]):
        description (Union[Unset, str]):
        kind (Union[Unset, str]):
        metadata (Union['PutBucketBucketsIdBodyMetadataType0Type1', None, Unset, bool, float, list[Any], str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    parent_id: None | Unset | str = UNSET
    name: Unset | str = UNSET
    description: Unset | str = UNSET
    kind: Unset | str = UNSET
    metadata: Union[
        "PutBucketBucketsIdBodyMetadataType0Type1", None, Unset, bool, float, list[Any], str
    ] = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_bucket_buckets_id_body_metadata_type_0_type_1 import (
            PutBucketBucketsIdBodyMetadataType0Type1,
        )

        ecosystem_id = self.ecosystem_id

        parent_id: Unset | str | None
        if isinstance(self.parent_id, Unset):
            parent_id = UNSET
        else:
            parent_id = self.parent_id

        name = self.name

        description = self.description

        kind = self.kind

        metadata: Unset | bool | dict[str, Any] | float | list[Any] | str | None
        if isinstance(self.metadata, Unset):
            metadata = UNSET
        elif isinstance(self.metadata, PutBucketBucketsIdBodyMetadataType0Type1):
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
        if parent_id is not UNSET:
            field_dict["parentId"] = parent_id
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if kind is not UNSET:
            field_dict["kind"] = kind
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_bucket_buckets_id_body_metadata_type_0_type_1 import (
            PutBucketBucketsIdBodyMetadataType0Type1,
        )

        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_parent_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        parent_id = _parse_parent_id(d.pop("parentId", UNSET))

        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        kind = d.pop("kind", UNSET)

        def _parse_metadata(
            data: object,
        ) -> Union[
            "PutBucketBucketsIdBodyMetadataType0Type1", None, Unset, bool, float, list[Any], str
        ]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                metadata_type_0_type_1 = PutBucketBucketsIdBodyMetadataType0Type1.from_dict(data)

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
                    "PutBucketBucketsIdBodyMetadataType0Type1",
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

        put_bucket_buckets_id_body = cls(
            ecosystem_id=ecosystem_id,
            parent_id=parent_id,
            name=name,
            description=description,
            kind=kind,
            metadata=metadata,
            sync_txid=sync_txid,
        )

        return put_bucket_buckets_id_body
