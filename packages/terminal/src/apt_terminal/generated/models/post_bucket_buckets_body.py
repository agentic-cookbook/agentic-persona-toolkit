from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_bucket_buckets_body_metadata_type_0_type_1 import (
        PostBucketBucketsBodyMetadataType0Type1,
    )


T = TypeVar("T", bound="PostBucketBucketsBody")


@_attrs_define
class PostBucketBucketsBody:
    """
    Attributes:
        name (str):
        ecosystem_id (Union[Unset, str]):
        parent_id (Union[None, Unset, str]):
        description (Union[Unset, str]):
        kind (Union[Unset, str]):
        metadata (Union['PostBucketBucketsBodyMetadataType0Type1', None, Unset, bool, float, list[Any], str]):
        sync_txid (Union[Unset, int]):
        id (Union[Unset, str]):
    """

    name: str
    ecosystem_id: Unset | str = UNSET
    parent_id: None | Unset | str = UNSET
    description: Unset | str = UNSET
    kind: Unset | str = UNSET
    metadata: Union[
        "PostBucketBucketsBodyMetadataType0Type1", None, Unset, bool, float, list[Any], str
    ] = UNSET
    sync_txid: Unset | int = UNSET
    id: Unset | str = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.post_bucket_buckets_body_metadata_type_0_type_1 import (
            PostBucketBucketsBodyMetadataType0Type1,
        )

        name = self.name

        ecosystem_id = self.ecosystem_id

        parent_id: None | Unset | str
        if isinstance(self.parent_id, Unset):
            parent_id = UNSET
        else:
            parent_id = self.parent_id

        description = self.description

        kind = self.kind

        metadata: None | Unset | bool | dict[str, Any] | float | list[Any] | str
        if isinstance(self.metadata, Unset):
            metadata = UNSET
        elif isinstance(self.metadata, PostBucketBucketsBodyMetadataType0Type1):
            metadata = self.metadata.to_dict()
        elif isinstance(self.metadata, list):
            metadata = self.metadata

        else:
            metadata = self.metadata

        sync_txid = self.sync_txid

        id = self.id

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "name": name,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if parent_id is not UNSET:
            field_dict["parentId"] = parent_id
        if description is not UNSET:
            field_dict["description"] = description
        if kind is not UNSET:
            field_dict["kind"] = kind
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid
        if id is not UNSET:
            field_dict["id"] = id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_bucket_buckets_body_metadata_type_0_type_1 import (
            PostBucketBucketsBodyMetadataType0Type1,
        )

        d = dict(src_dict)
        name = d.pop("name")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_parent_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        parent_id = _parse_parent_id(d.pop("parentId", UNSET))

        description = d.pop("description", UNSET)

        kind = d.pop("kind", UNSET)

        def _parse_metadata(
            data: object,
        ) -> Union[
            "PostBucketBucketsBodyMetadataType0Type1", None, Unset, bool, float, list[Any], str
        ]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                metadata_type_0_type_1 = PostBucketBucketsBodyMetadataType0Type1.from_dict(data)

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
                    "PostBucketBucketsBodyMetadataType0Type1",
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

        id = d.pop("id", UNSET)

        post_bucket_buckets_body = cls(
            name=name,
            ecosystem_id=ecosystem_id,
            parent_id=parent_id,
            description=description,
            kind=kind,
            metadata=metadata,
            sync_txid=sync_txid,
            id=id,
        )

        return post_bucket_buckets_body
