from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.put_me_appearance_body_color_mode import PutMeAppearanceBodyColorMode
from ..models.put_me_appearance_body_contrast import PutMeAppearanceBodyContrast
from ..models.put_me_appearance_body_reduce_motion import PutMeAppearanceBodyReduceMotion
from ..models.put_me_appearance_body_spacing import PutMeAppearanceBodySpacing
from ..models.put_me_appearance_body_text_size import PutMeAppearanceBodyTextSize
from ..types import UNSET, Unset

T = TypeVar("T", bound="PutMeAppearanceBody")


@_attrs_define
class PutMeAppearanceBody:
    """
    Attributes:
        color_mode (Union[Unset, PutMeAppearanceBodyColorMode]): The user's colour scheme; 'auto' follows the operating
            system
        reduce_motion (Union[Unset, PutMeAppearanceBodyReduceMotion]):
        contrast (Union[Unset, PutMeAppearanceBodyContrast]):
        text_size (Union[Unset, PutMeAppearanceBodyTextSize]):
        spacing (Union[Unset, PutMeAppearanceBodySpacing]):
        focus_outlines (Union[Unset, bool]):
        underline_links (Union[Unset, bool]):
    """

    color_mode: Unset | PutMeAppearanceBodyColorMode = UNSET
    reduce_motion: Unset | PutMeAppearanceBodyReduceMotion = UNSET
    contrast: Unset | PutMeAppearanceBodyContrast = UNSET
    text_size: Unset | PutMeAppearanceBodyTextSize = UNSET
    spacing: Unset | PutMeAppearanceBodySpacing = UNSET
    focus_outlines: Unset | bool = UNSET
    underline_links: Unset | bool = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        color_mode: Unset | str = UNSET
        if not isinstance(self.color_mode, Unset):
            color_mode = self.color_mode.value

        reduce_motion: Unset | str = UNSET
        if not isinstance(self.reduce_motion, Unset):
            reduce_motion = self.reduce_motion.value

        contrast: Unset | str = UNSET
        if not isinstance(self.contrast, Unset):
            contrast = self.contrast.value

        text_size: Unset | str = UNSET
        if not isinstance(self.text_size, Unset):
            text_size = self.text_size.value

        spacing: Unset | str = UNSET
        if not isinstance(self.spacing, Unset):
            spacing = self.spacing.value

        focus_outlines = self.focus_outlines

        underline_links = self.underline_links

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if color_mode is not UNSET:
            field_dict["colorMode"] = color_mode
        if reduce_motion is not UNSET:
            field_dict["reduceMotion"] = reduce_motion
        if contrast is not UNSET:
            field_dict["contrast"] = contrast
        if text_size is not UNSET:
            field_dict["textSize"] = text_size
        if spacing is not UNSET:
            field_dict["spacing"] = spacing
        if focus_outlines is not UNSET:
            field_dict["focusOutlines"] = focus_outlines
        if underline_links is not UNSET:
            field_dict["underlineLinks"] = underline_links

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _color_mode = d.pop("colorMode", UNSET)
        color_mode: Unset | PutMeAppearanceBodyColorMode
        if isinstance(_color_mode, Unset):
            color_mode = UNSET
        else:
            color_mode = PutMeAppearanceBodyColorMode(_color_mode)

        _reduce_motion = d.pop("reduceMotion", UNSET)
        reduce_motion: Unset | PutMeAppearanceBodyReduceMotion
        if isinstance(_reduce_motion, Unset):
            reduce_motion = UNSET
        else:
            reduce_motion = PutMeAppearanceBodyReduceMotion(_reduce_motion)

        _contrast = d.pop("contrast", UNSET)
        contrast: Unset | PutMeAppearanceBodyContrast
        if isinstance(_contrast, Unset):
            contrast = UNSET
        else:
            contrast = PutMeAppearanceBodyContrast(_contrast)

        _text_size = d.pop("textSize", UNSET)
        text_size: Unset | PutMeAppearanceBodyTextSize
        if isinstance(_text_size, Unset):
            text_size = UNSET
        else:
            text_size = PutMeAppearanceBodyTextSize(_text_size)

        _spacing = d.pop("spacing", UNSET)
        spacing: Unset | PutMeAppearanceBodySpacing
        if isinstance(_spacing, Unset):
            spacing = UNSET
        else:
            spacing = PutMeAppearanceBodySpacing(_spacing)

        focus_outlines = d.pop("focusOutlines", UNSET)

        underline_links = d.pop("underlineLinks", UNSET)

        put_me_appearance_body = cls(
            color_mode=color_mode,
            reduce_motion=reduce_motion,
            contrast=contrast,
            text_size=text_size,
            spacing=spacing,
            focus_outlines=focus_outlines,
            underline_links=underline_links,
        )

        put_me_appearance_body.additional_properties = d
        return put_me_appearance_body

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
