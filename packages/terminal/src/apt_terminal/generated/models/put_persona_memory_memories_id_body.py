from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutPersonaMemoryMemoriesIdBody")


@_attrs_define
class PutPersonaMemoryMemoriesIdBody:
    """
    Attributes:
        ecosystem_id (Union[Unset, str]):
        persona_id (Union[Unset, UUID]):
        scope (Union[Unset, str]):
        slug (Union[Unset, str]):
        memory_type (Union[Unset, str]):
        description (Union[Unset, str]):
        body (Union[Unset, str]):
        subject_table (Union[None, Unset, str]):
        subject_id (Union[None, Unset, str]):
        status (Union[Unset, str]):
        supersedes_id (Union[None, Unset, str]):
        source (Union[Unset, str]):
        confidence (Union[Unset, int]):
        tags (Union[Unset, list[str]]):
        valid_from (Union[None, Unset, str]):
        valid_to (Union[None, Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    ecosystem_id: Unset | str = UNSET
    persona_id: Unset | UUID = UNSET
    scope: Unset | str = UNSET
    slug: Unset | str = UNSET
    memory_type: Unset | str = UNSET
    description: Unset | str = UNSET
    body: Unset | str = UNSET
    subject_table: None | Unset | str = UNSET
    subject_id: None | Unset | str = UNSET
    status: Unset | str = UNSET
    supersedes_id: None | Unset | str = UNSET
    source: Unset | str = UNSET
    confidence: Unset | int = UNSET
    tags: Unset | list[str] = UNSET
    valid_from: None | Unset | str = UNSET
    valid_to: None | Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        ecosystem_id = self.ecosystem_id

        persona_id: Unset | str = UNSET
        if not isinstance(self.persona_id, Unset):
            persona_id = str(self.persona_id)

        scope = self.scope

        slug = self.slug

        memory_type = self.memory_type

        description = self.description

        body = self.body

        subject_table: None | Unset | str
        if isinstance(self.subject_table, Unset):
            subject_table = UNSET
        else:
            subject_table = self.subject_table

        subject_id: None | Unset | str
        if isinstance(self.subject_id, Unset):
            subject_id = UNSET
        else:
            subject_id = self.subject_id

        status = self.status

        supersedes_id: None | Unset | str
        if isinstance(self.supersedes_id, Unset):
            supersedes_id = UNSET
        else:
            supersedes_id = self.supersedes_id

        source = self.source

        confidence = self.confidence

        tags: Unset | list[str] = UNSET
        if not isinstance(self.tags, Unset):
            tags = self.tags

        valid_from: None | Unset | str
        if isinstance(self.valid_from, Unset):
            valid_from = UNSET
        else:
            valid_from = self.valid_from

        valid_to: None | Unset | str
        if isinstance(self.valid_to, Unset):
            valid_to = UNSET
        else:
            valid_to = self.valid_to

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if persona_id is not UNSET:
            field_dict["personaId"] = persona_id
        if scope is not UNSET:
            field_dict["scope"] = scope
        if slug is not UNSET:
            field_dict["slug"] = slug
        if memory_type is not UNSET:
            field_dict["memoryType"] = memory_type
        if description is not UNSET:
            field_dict["description"] = description
        if body is not UNSET:
            field_dict["body"] = body
        if subject_table is not UNSET:
            field_dict["subjectTable"] = subject_table
        if subject_id is not UNSET:
            field_dict["subjectId"] = subject_id
        if status is not UNSET:
            field_dict["status"] = status
        if supersedes_id is not UNSET:
            field_dict["supersedesId"] = supersedes_id
        if source is not UNSET:
            field_dict["source"] = source
        if confidence is not UNSET:
            field_dict["confidence"] = confidence
        if tags is not UNSET:
            field_dict["tags"] = tags
        if valid_from is not UNSET:
            field_dict["validFrom"] = valid_from
        if valid_to is not UNSET:
            field_dict["validTo"] = valid_to
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ecosystem_id = d.pop("ecosystemId", UNSET)

        _persona_id = d.pop("personaId", UNSET)
        persona_id: Unset | UUID
        if isinstance(_persona_id, Unset):
            persona_id = UNSET
        else:
            persona_id = UUID(_persona_id)

        scope = d.pop("scope", UNSET)

        slug = d.pop("slug", UNSET)

        memory_type = d.pop("memoryType", UNSET)

        description = d.pop("description", UNSET)

        body = d.pop("body", UNSET)

        def _parse_subject_table(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        subject_table = _parse_subject_table(d.pop("subjectTable", UNSET))

        def _parse_subject_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        subject_id = _parse_subject_id(d.pop("subjectId", UNSET))

        status = d.pop("status", UNSET)

        def _parse_supersedes_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        supersedes_id = _parse_supersedes_id(d.pop("supersedesId", UNSET))

        source = d.pop("source", UNSET)

        confidence = d.pop("confidence", UNSET)

        tags = cast(list[str], d.pop("tags", UNSET))

        def _parse_valid_from(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        valid_from = _parse_valid_from(d.pop("validFrom", UNSET))

        def _parse_valid_to(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        valid_to = _parse_valid_to(d.pop("validTo", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        put_persona_memory_memories_id_body = cls(
            ecosystem_id=ecosystem_id,
            persona_id=persona_id,
            scope=scope,
            slug=slug,
            memory_type=memory_type,
            description=description,
            body=body,
            subject_table=subject_table,
            subject_id=subject_id,
            status=status,
            supersedes_id=supersedes_id,
            source=source,
            confidence=confidence,
            tags=tags,
            valid_from=valid_from,
            valid_to=valid_to,
            sync_txid=sync_txid,
        )

        return put_persona_memory_memories_id_body
