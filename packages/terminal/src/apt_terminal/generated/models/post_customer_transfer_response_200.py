from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.post_customer_transfer_response_200_conflicts_item import (
        PostCustomerTransferResponse200ConflictsItem,
    )
    from ..models.post_customer_transfer_response_200_moved import (
        PostCustomerTransferResponse200Moved,
    )


T = TypeVar("T", bound="PostCustomerTransferResponse200")


@_attrs_define
class PostCustomerTransferResponse200:
    """
    Attributes:
        user_id (Union[Unset, str]):
        from_ (Union[Unset, str]):
        to (Union[Unset, str]):
        dry_run (Union[Unset, bool]):
        moved (Union[Unset, PostCustomerTransferResponse200Moved]):
        revoked (Union[Unset, int]): API tokens deleted
        ecosystems_reparented (Union[Unset, int]):
        rewritten (Union[Unset, int]): addresses re-derived by the cascade
        conflicts (Union[Unset, list['PostCustomerTransferResponse200ConflictsItem']]):
    """

    user_id: Unset | str = UNSET
    from_: Unset | str = UNSET
    to: Unset | str = UNSET
    dry_run: Unset | bool = UNSET
    moved: Union[Unset, "PostCustomerTransferResponse200Moved"] = UNSET
    revoked: Unset | int = UNSET
    ecosystems_reparented: Unset | int = UNSET
    rewritten: Unset | int = UNSET
    conflicts: Unset | list["PostCustomerTransferResponse200ConflictsItem"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        user_id = self.user_id

        from_ = self.from_

        to = self.to

        dry_run = self.dry_run

        moved: Unset | dict[str, Any] = UNSET
        if not isinstance(self.moved, Unset):
            moved = self.moved.to_dict()

        revoked = self.revoked

        ecosystems_reparented = self.ecosystems_reparented

        rewritten = self.rewritten

        conflicts: Unset | list[dict[str, Any]] = UNSET
        if not isinstance(self.conflicts, Unset):
            conflicts = []
            for conflicts_item_data in self.conflicts:
                conflicts_item = conflicts_item_data.to_dict()
                conflicts.append(conflicts_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if user_id is not UNSET:
            field_dict["userId"] = user_id
        if from_ is not UNSET:
            field_dict["from"] = from_
        if to is not UNSET:
            field_dict["to"] = to
        if dry_run is not UNSET:
            field_dict["dryRun"] = dry_run
        if moved is not UNSET:
            field_dict["moved"] = moved
        if revoked is not UNSET:
            field_dict["revoked"] = revoked
        if ecosystems_reparented is not UNSET:
            field_dict["ecosystemsReparented"] = ecosystems_reparented
        if rewritten is not UNSET:
            field_dict["rewritten"] = rewritten
        if conflicts is not UNSET:
            field_dict["conflicts"] = conflicts

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.post_customer_transfer_response_200_conflicts_item import (
            PostCustomerTransferResponse200ConflictsItem,
        )
        from ..models.post_customer_transfer_response_200_moved import (
            PostCustomerTransferResponse200Moved,
        )

        d = dict(src_dict)
        user_id = d.pop("userId", UNSET)

        from_ = d.pop("from", UNSET)

        to = d.pop("to", UNSET)

        dry_run = d.pop("dryRun", UNSET)

        _moved = d.pop("moved", UNSET)
        moved: Unset | PostCustomerTransferResponse200Moved
        if isinstance(_moved, Unset):
            moved = UNSET
        else:
            moved = PostCustomerTransferResponse200Moved.from_dict(_moved)

        revoked = d.pop("revoked", UNSET)

        ecosystems_reparented = d.pop("ecosystemsReparented", UNSET)

        rewritten = d.pop("rewritten", UNSET)

        conflicts = []
        _conflicts = d.pop("conflicts", UNSET)
        for conflicts_item_data in _conflicts or []:
            conflicts_item = PostCustomerTransferResponse200ConflictsItem.from_dict(
                conflicts_item_data
            )

            conflicts.append(conflicts_item)

        post_customer_transfer_response_200 = cls(
            user_id=user_id,
            from_=from_,
            to=to,
            dry_run=dry_run,
            moved=moved,
            revoked=revoked,
            ecosystems_reparented=ecosystems_reparented,
            rewritten=rewritten,
            conflicts=conflicts,
        )

        post_customer_transfer_response_200.additional_properties = d
        return post_customer_transfer_response_200

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
