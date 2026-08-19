from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.project_comment_author_kind import ProjectCommentAuthorKind
from ..types import UNSET, Unset

T = TypeVar("T", bound="ProjectComment")


@_attrs_define
class ProjectComment:
    """
    Attributes:
        id (str):
        ecosystem_id (str):
        project_id (str):
        work_item_id (str):
        body (str):
        created_at (str):
        parent_id (Union[None, Unset, str]): the comment this one replies to; null for a top-level comment
        author_kind (Union[Unset, ProjectCommentAuthorKind]):
        author_id (Union[None, Unset, str]):
        author_label (Union[None, Unset, str]):
        edited_at (Union[None, Unset, str]): set the first time the body changes; the prior text is in the trail
        updated_at (Union[Unset, str]):
    """

    id: str
    ecosystem_id: str
    project_id: str
    work_item_id: str
    body: str
    created_at: str
    parent_id: None | Unset | str = UNSET
    author_kind: Unset | ProjectCommentAuthorKind = UNSET
    author_id: None | Unset | str = UNSET
    author_label: None | Unset | str = UNSET
    edited_at: None | Unset | str = UNSET
    updated_at: Unset | str = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        ecosystem_id = self.ecosystem_id

        project_id = self.project_id

        work_item_id = self.work_item_id

        body = self.body

        created_at = self.created_at

        parent_id: Unset | str | None
        if isinstance(self.parent_id, Unset):
            parent_id = UNSET
        else:
            parent_id = self.parent_id

        author_kind: Unset | str = UNSET
        if not isinstance(self.author_kind, Unset):
            author_kind = self.author_kind.value

        author_id: Unset | str | None
        if isinstance(self.author_id, Unset):
            author_id = UNSET
        else:
            author_id = self.author_id

        author_label: Unset | str | None
        if isinstance(self.author_label, Unset):
            author_label = UNSET
        else:
            author_label = self.author_label

        edited_at: Unset | str | None
        if isinstance(self.edited_at, Unset):
            edited_at = UNSET
        else:
            edited_at = self.edited_at

        updated_at = self.updated_at

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "ecosystemId": ecosystem_id,
                "projectId": project_id,
                "workItemId": work_item_id,
                "body": body,
                "createdAt": created_at,
            }
        )
        if parent_id is not UNSET:
            field_dict["parentId"] = parent_id
        if author_kind is not UNSET:
            field_dict["authorKind"] = author_kind
        if author_id is not UNSET:
            field_dict["authorId"] = author_id
        if author_label is not UNSET:
            field_dict["authorLabel"] = author_label
        if edited_at is not UNSET:
            field_dict["editedAt"] = edited_at
        if updated_at is not UNSET:
            field_dict["updatedAt"] = updated_at

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        ecosystem_id = d.pop("ecosystemId")

        project_id = d.pop("projectId")

        work_item_id = d.pop("workItemId")

        body = d.pop("body")

        created_at = d.pop("createdAt")

        def _parse_parent_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        parent_id = _parse_parent_id(d.pop("parentId", UNSET))

        _author_kind = d.pop("authorKind", UNSET)
        author_kind: Unset | ProjectCommentAuthorKind
        if isinstance(_author_kind, Unset):
            author_kind = UNSET
        else:
            author_kind = ProjectCommentAuthorKind(_author_kind)

        def _parse_author_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        author_id = _parse_author_id(d.pop("authorId", UNSET))

        def _parse_author_label(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        author_label = _parse_author_label(d.pop("authorLabel", UNSET))

        def _parse_edited_at(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        edited_at = _parse_edited_at(d.pop("editedAt", UNSET))

        updated_at = d.pop("updatedAt", UNSET)

        project_comment = cls(
            id=id,
            ecosystem_id=ecosystem_id,
            project_id=project_id,
            work_item_id=work_item_id,
            body=body,
            created_at=created_at,
            parent_id=parent_id,
            author_kind=author_kind,
            author_id=author_id,
            author_label=author_label,
            edited_at=edited_at,
            updated_at=updated_at,
        )

        project_comment.additional_properties = d
        return project_comment

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
