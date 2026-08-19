from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostAudienceListsBody")


@_attrs_define
class PostAudienceListsBody:
    """
    Attributes:
        name (str):
        slug (str):
        ecosystem_id (Union[Unset, str]):
        description (Union[None, Unset, str]):
        status (Union[Unset, str]):
        welcome_template_id (Union[None, Unset, str]):
        welcome_back_template_id (Union[None, Unset, str]):
        from_name (Union[None, Unset, str]):
    """

    name: str
    slug: str
    ecosystem_id: Unset | str = UNSET
    description: None | Unset | str = UNSET
    status: Unset | str = UNSET
    welcome_template_id: None | Unset | str = UNSET
    welcome_back_template_id: None | Unset | str = UNSET
    from_name: None | Unset | str = UNSET

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        slug = self.slug

        ecosystem_id = self.ecosystem_id

        description: Unset | str | None
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        status = self.status

        welcome_template_id: Unset | str | None
        if isinstance(self.welcome_template_id, Unset):
            welcome_template_id = UNSET
        else:
            welcome_template_id = self.welcome_template_id

        welcome_back_template_id: Unset | str | None
        if isinstance(self.welcome_back_template_id, Unset):
            welcome_back_template_id = UNSET
        else:
            welcome_back_template_id = self.welcome_back_template_id

        from_name: Unset | str | None
        if isinstance(self.from_name, Unset):
            from_name = UNSET
        else:
            from_name = self.from_name

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "name": name,
                "slug": slug,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if description is not UNSET:
            field_dict["description"] = description
        if status is not UNSET:
            field_dict["status"] = status
        if welcome_template_id is not UNSET:
            field_dict["welcomeTemplateId"] = welcome_template_id
        if welcome_back_template_id is not UNSET:
            field_dict["welcomeBackTemplateId"] = welcome_back_template_id
        if from_name is not UNSET:
            field_dict["fromName"] = from_name

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        slug = d.pop("slug")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_description(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        description = _parse_description(d.pop("description", UNSET))

        status = d.pop("status", UNSET)

        def _parse_welcome_template_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        welcome_template_id = _parse_welcome_template_id(d.pop("welcomeTemplateId", UNSET))

        def _parse_welcome_back_template_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        welcome_back_template_id = _parse_welcome_back_template_id(
            d.pop("welcomeBackTemplateId", UNSET)
        )

        def _parse_from_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        from_name = _parse_from_name(d.pop("fromName", UNSET))

        post_audience_lists_body = cls(
            name=name,
            slug=slug,
            ecosystem_id=ecosystem_id,
            description=description,
            status=status,
            welcome_template_id=welcome_template_id,
            welcome_back_template_id=welcome_back_template_id,
            from_name=from_name,
        )

        return post_audience_lists_body
