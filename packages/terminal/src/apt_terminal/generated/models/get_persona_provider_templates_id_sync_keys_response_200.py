from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.template_sync_keys_type_0 import TemplateSyncKeysType0


T = TypeVar("T", bound="GetPersonaProviderTemplatesIdSyncKeysResponse200")


@_attrs_define
class GetPersonaProviderTemplatesIdSyncKeysResponse200:
    """
    Attributes:
        sync_keys (Union['TemplateSyncKeysType0', None]): Operator-only upstream sync mapping — never present on public
            reads.
    """

    sync_keys: Union["TemplateSyncKeysType0", None]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.template_sync_keys_type_0 import TemplateSyncKeysType0

        sync_keys: None | dict[str, Any]
        if isinstance(self.sync_keys, TemplateSyncKeysType0):
            sync_keys = self.sync_keys.to_dict()
        else:
            sync_keys = self.sync_keys

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "syncKeys": sync_keys,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_sync_keys_type_0 import TemplateSyncKeysType0

        d = dict(src_dict)

        def _parse_sync_keys(data: object) -> Union["TemplateSyncKeysType0", None]:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_template_sync_keys_type_0 = TemplateSyncKeysType0.from_dict(data)

                return componentsschemas_template_sync_keys_type_0
            except:  # noqa: E722
                pass
            return cast(Union["TemplateSyncKeysType0", None], data)

        sync_keys = _parse_sync_keys(d.pop("syncKeys"))

        get_persona_provider_templates_id_sync_keys_response_200 = cls(
            sync_keys=sync_keys,
        )

        get_persona_provider_templates_id_sync_keys_response_200.additional_properties = d
        return get_persona_provider_templates_id_sync_keys_response_200

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
