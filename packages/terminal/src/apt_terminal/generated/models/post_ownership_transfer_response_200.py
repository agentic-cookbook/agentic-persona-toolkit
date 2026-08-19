from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_ownership_transfer_response_200_revoked import (
        PostOwnershipTransferResponse200Revoked,
    )


T = TypeVar("T", bound="PostOwnershipTransferResponse200")


@_attrs_define
class PostOwnershipTransferResponse200:
    """
    Attributes:
        id (Union[None, Unset, str]): the rdid the object now has
        previous_id (Union[None, Unset, str]):
        rewritten (Union[Unset, int]): addresses re-derived by the cascade
        revoked (Union[Unset, PostOwnershipTransferResponse200Revoked]):
    """

    id: None | Unset | str = UNSET
    previous_id: None | Unset | str = UNSET
    rewritten: Unset | int = UNSET
    revoked: Union[Unset, "PostOwnershipTransferResponse200Revoked"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id: Unset | str | None
        if isinstance(self.id, Unset):
            id = UNSET
        else:
            id = self.id

        previous_id: Unset | str | None
        if isinstance(self.previous_id, Unset):
            previous_id = UNSET
        else:
            previous_id = self.previous_id

        rewritten = self.rewritten

        revoked: Unset | dict[str, Any] = UNSET
        if not isinstance(self.revoked, Unset):
            revoked = self.revoked.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if id is not UNSET:
            field_dict["id"] = id
        if previous_id is not UNSET:
            field_dict["previousId"] = previous_id
        if rewritten is not UNSET:
            field_dict["rewritten"] = rewritten
        if revoked is not UNSET:
            field_dict["revoked"] = revoked

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_ownership_transfer_response_200_revoked import (
            PostOwnershipTransferResponse200Revoked,
        )

        d = dict(src_dict)

        def _parse_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        id = _parse_id(d.pop("id", UNSET))

        def _parse_previous_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        previous_id = _parse_previous_id(d.pop("previousId", UNSET))

        rewritten = d.pop("rewritten", UNSET)

        _revoked = d.pop("revoked", UNSET)
        revoked: Unset | PostOwnershipTransferResponse200Revoked
        if isinstance(_revoked, Unset):
            revoked = UNSET
        else:
            revoked = PostOwnershipTransferResponse200Revoked.from_dict(_revoked)

        post_ownership_transfer_response_200 = cls(
            id=id,
            previous_id=previous_id,
            rewritten=rewritten,
            revoked=revoked,
        )

        post_ownership_transfer_response_200.additional_properties = d
        return post_ownership_transfer_response_200

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
