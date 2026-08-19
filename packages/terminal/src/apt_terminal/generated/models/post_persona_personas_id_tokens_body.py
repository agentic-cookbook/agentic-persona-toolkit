import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_persona_personas_id_tokens_body_subject import (
        PostPersonaPersonasIdTokensBodySubject,
    )


T = TypeVar("T", bound="PostPersonaPersonasIdTokensBody")


@_attrs_define
class PostPersonaPersonasIdTokensBody:
    """
    Attributes:
        subject (PostPersonaPersonasIdTokensBodySubject):
        name (Union[Unset, str]):
        expires_at (Union[None, Unset, datetime.datetime]): Omitted/null defaults to a bounded 90-day TTL (never a non-
            expiring token); an explicit value is honored.
    """

    subject: "PostPersonaPersonasIdTokensBodySubject"
    name: Unset | str = UNSET
    expires_at: None | Unset | datetime.datetime = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        subject = self.subject.to_dict()

        name = self.name

        expires_at: Unset | str | None
        if isinstance(self.expires_at, Unset):
            expires_at = UNSET
        elif isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "subject": subject,
            }
        )
        if name is not UNSET:
            field_dict["name"] = name
        if expires_at is not UNSET:
            field_dict["expiresAt"] = expires_at

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_persona_personas_id_tokens_body_subject import (
            PostPersonaPersonasIdTokensBodySubject,
        )

        d = dict(src_dict)
        subject = PostPersonaPersonasIdTokensBodySubject.from_dict(d.pop("subject"))

        name = d.pop("name", UNSET)

        def _parse_expires_at(data: object) -> None | Unset | datetime.datetime:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = isoparse(data)

                return expires_at_type_0
            except:  # noqa: E722
                pass
            return cast(None | Unset | datetime.datetime, data)

        expires_at = _parse_expires_at(d.pop("expiresAt", UNSET))

        post_persona_personas_id_tokens_body = cls(
            subject=subject,
            name=name,
            expires_at=expires_at,
        )

        post_persona_personas_id_tokens_body.additional_properties = d
        return post_persona_personas_id_tokens_body

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
