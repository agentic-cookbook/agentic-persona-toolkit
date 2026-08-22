from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutPersonaSpecialInterestsIdBody")


@_attrs_define
class PutPersonaSpecialInterestsIdBody:
    """
    Attributes:
        persona_id (Union[Unset, str]):
        slug (Union[Unset, str]):
        general (Union[Unset, str]):
        topical (Union[None, Unset, str]):
        specific (Union[None, Unset, str]):
        stances (Union[None, Unset, str]):
        position (Union[Unset, int]):
    """

    persona_id: Unset | str = UNSET
    slug: Unset | str = UNSET
    general: Unset | str = UNSET
    topical: None | Unset | str = UNSET
    specific: None | Unset | str = UNSET
    stances: None | Unset | str = UNSET
    position: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        persona_id = self.persona_id

        slug = self.slug

        general = self.general

        topical: None | Unset | str
        if isinstance(self.topical, Unset):
            topical = UNSET
        else:
            topical = self.topical

        specific: None | Unset | str
        if isinstance(self.specific, Unset):
            specific = UNSET
        else:
            specific = self.specific

        stances: None | Unset | str
        if isinstance(self.stances, Unset):
            stances = UNSET
        else:
            stances = self.stances

        position = self.position

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if persona_id is not UNSET:
            field_dict["personaId"] = persona_id
        if slug is not UNSET:
            field_dict["slug"] = slug
        if general is not UNSET:
            field_dict["general"] = general
        if topical is not UNSET:
            field_dict["topical"] = topical
        if specific is not UNSET:
            field_dict["specific"] = specific
        if stances is not UNSET:
            field_dict["stances"] = stances
        if position is not UNSET:
            field_dict["position"] = position

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        persona_id = d.pop("personaId", UNSET)

        slug = d.pop("slug", UNSET)

        general = d.pop("general", UNSET)

        def _parse_topical(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        topical = _parse_topical(d.pop("topical", UNSET))

        def _parse_specific(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        specific = _parse_specific(d.pop("specific", UNSET))

        def _parse_stances(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        stances = _parse_stances(d.pop("stances", UNSET))

        position = d.pop("position", UNSET)

        put_persona_special_interests_id_body = cls(
            persona_id=persona_id,
            slug=slug,
            general=general,
            topical=topical,
            specific=specific,
            stances=stances,
            position=position,
        )

        return put_persona_special_interests_id_body
