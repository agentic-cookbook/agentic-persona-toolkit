from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.put_content_key_value_pairs_id_body_value_type_1 import (
        PutContentKeyValuePairsIdBodyValueType1,
    )


T = TypeVar("T", bound="PutContentKeyValuePairsIdBody")


@_attrs_define
class PutContentKeyValuePairsIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        key (Union[Unset, str]):
        value (Union['PutContentKeyValuePairsIdBodyValueType1', None, Unset, bool, float, list[Any], str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    key: Unset | str = UNSET
    value: Union[
        "PutContentKeyValuePairsIdBodyValueType1", None, Unset, bool, float, list[Any], str
    ] = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_content_key_value_pairs_id_body_value_type_1 import (
            PutContentKeyValuePairsIdBodyValueType1,
        )

        ecosystem_id = self.ecosystem_id

        key = self.key

        value: Unset | bool | dict[str, Any] | float | list[Any] | str | None
        if isinstance(self.value, Unset):
            value = UNSET
        elif isinstance(self.value, PutContentKeyValuePairsIdBodyValueType1):
            value = self.value.to_dict()
        elif isinstance(self.value, list):
            value = self.value

        else:
            value = self.value

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if key is not UNSET:
            field_dict["key"] = key
        if value is not UNSET:
            field_dict["value"] = value
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_content_key_value_pairs_id_body_value_type_1 import (
            PutContentKeyValuePairsIdBodyValueType1,
        )

        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        key = d.pop("key", UNSET)

        def _parse_value(
            data: object,
        ) -> Union[
            "PutContentKeyValuePairsIdBodyValueType1", None, Unset, bool, float, list[Any], str
        ]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                value_type_1 = PutContentKeyValuePairsIdBodyValueType1.from_dict(data)

                return value_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                value_type_2 = cast(list[Any], data)

                return value_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union[
                    "PutContentKeyValuePairsIdBodyValueType1",
                    None,
                    Unset,
                    bool,
                    float,
                    list[Any],
                    str,
                ],
                data,
            )

        value = _parse_value(d.pop("value", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        put_content_key_value_pairs_id_body = cls(
            ecosystem_id=ecosystem_id,
            key=key,
            value=value,
            sync_txid=sync_txid,
        )

        return put_content_key_value_pairs_id_body
