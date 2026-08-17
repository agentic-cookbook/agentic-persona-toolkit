from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_ownership_transfer_response_200_revoked_subjects_item import (
        PostOwnershipTransferResponse200RevokedSubjectsItem,
    )


T = TypeVar("T", bound="PostOwnershipTransferResponse200Revoked")


@_attrs_define
class PostOwnershipTransferResponse200Revoked:
    """
    Attributes:
        tokens (Union[Unset, int]): API tokens revoked
        subjects (Union[Unset, list['PostOwnershipTransferResponse200RevokedSubjectsItem']]): principals that lose reach
            over the object once it moves
    """

    tokens: Unset | int = UNSET
    subjects: Unset | list["PostOwnershipTransferResponse200RevokedSubjectsItem"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        tokens = self.tokens

        subjects: Unset | list[dict[str, Any]] = UNSET
        if not isinstance(self.subjects, Unset):
            subjects = []
            for subjects_item_data in self.subjects:
                subjects_item = subjects_item_data.to_dict()
                subjects.append(subjects_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if tokens is not UNSET:
            field_dict["tokens"] = tokens
        if subjects is not UNSET:
            field_dict["subjects"] = subjects

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_ownership_transfer_response_200_revoked_subjects_item import (
            PostOwnershipTransferResponse200RevokedSubjectsItem,
        )

        d = dict(src_dict)
        tokens = d.pop("tokens", UNSET)

        subjects = []
        _subjects = d.pop("subjects", UNSET)
        for subjects_item_data in _subjects or []:
            subjects_item = PostOwnershipTransferResponse200RevokedSubjectsItem.from_dict(
                subjects_item_data
            )

            subjects.append(subjects_item)

        post_ownership_transfer_response_200_revoked = cls(
            tokens=tokens,
            subjects=subjects,
        )

        post_ownership_transfer_response_200_revoked.additional_properties = d
        return post_ownership_transfer_response_200_revoked

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
