from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.patch_project_projects_id_fields_field_id_body_type import (
    PatchProjectProjectsIdFieldsFieldIdBodyType,
)
from ..types import UNSET, Unset

T = TypeVar("T", bound="PatchProjectProjectsIdFieldsFieldIdBody")


@_attrs_define
class PatchProjectProjectsIdFieldsFieldIdBody:
    """At least one mutable field is required (a no-op patch is a 400). `key` is immutable.

    Attributes:
        label (Union[Unset, str]):
        type_ (Union[Unset, PatchProjectProjectsIdFieldsFieldIdBodyType]):
        options (Union[None, Unset, list[str]]): null clears the list; a select field requires a non-empty list on the
            effective (post-patch) type
        position (Union[Unset, int]):
    """

    label: Unset | str = UNSET
    type_: Unset | PatchProjectProjectsIdFieldsFieldIdBodyType = UNSET
    options: None | Unset | list[str] = UNSET
    position: Unset | int = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        label = self.label

        type_: Unset | str = UNSET
        if not isinstance(self.type_, Unset):
            type_ = self.type_.value

        options: None | Unset | list[str]
        if isinstance(self.options, Unset):
            options = UNSET
        elif isinstance(self.options, list):
            options = self.options

        else:
            options = self.options

        position = self.position

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if label is not UNSET:
            field_dict["label"] = label
        if type_ is not UNSET:
            field_dict["type"] = type_
        if options is not UNSET:
            field_dict["options"] = options
        if position is not UNSET:
            field_dict["position"] = position

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        label = d.pop("label", UNSET)

        _type_ = d.pop("type", UNSET)
        type_: Unset | PatchProjectProjectsIdFieldsFieldIdBodyType
        if isinstance(_type_, Unset):
            type_ = UNSET
        else:
            type_ = PatchProjectProjectsIdFieldsFieldIdBodyType(_type_)

        def _parse_options(data: object) -> None | Unset | list[str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                options_type_0 = cast(list[str], data)

                return options_type_0
            except:  # noqa: E722
                pass
            return cast(None | Unset | list[str], data)

        options = _parse_options(d.pop("options", UNSET))

        position = d.pop("position", UNSET)

        patch_project_projects_id_fields_field_id_body = cls(
            label=label,
            type_=type_,
            options=options,
            position=position,
        )

        patch_project_projects_id_fields_field_id_body.additional_properties = d
        return patch_project_projects_id_fields_field_id_body

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
