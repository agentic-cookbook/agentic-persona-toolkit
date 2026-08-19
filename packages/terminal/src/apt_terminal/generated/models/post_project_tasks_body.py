from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostProjectTasksBody")


@_attrs_define
class PostProjectTasksBody:
    """
    Attributes:
        connection_id (str):
        external_id (str):
        source_provider (str):
        title (str):
        ecosystem_id (Union[Unset, str]):
        description (Union[None, Unset, str]):
        is_completed (Union[Unset, bool]):
        priority (Union[Unset, int]):
        due_date (Union[None, Unset, str]):
        due_datetime (Union[None, Unset, str]):
        external_project_id (Union[None, Unset, str]):
        external_project_name (Union[None, Unset, str]):
        labels (Union[None, Unset, str]):
        url (Union[None, Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    connection_id: str
    external_id: str
    source_provider: str
    title: str
    ecosystem_id: Unset | str = UNSET
    description: None | Unset | str = UNSET
    is_completed: Unset | bool = UNSET
    priority: Unset | int = UNSET
    due_date: None | Unset | str = UNSET
    due_datetime: None | Unset | str = UNSET
    external_project_id: None | Unset | str = UNSET
    external_project_name: None | Unset | str = UNSET
    labels: None | Unset | str = UNSET
    url: None | Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        connection_id = self.connection_id

        external_id = self.external_id

        source_provider = self.source_provider

        title = self.title

        ecosystem_id = self.ecosystem_id

        description: Unset | str | None
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        is_completed = self.is_completed

        priority = self.priority

        due_date: Unset | str | None
        if isinstance(self.due_date, Unset):
            due_date = UNSET
        else:
            due_date = self.due_date

        due_datetime: Unset | str | None
        if isinstance(self.due_datetime, Unset):
            due_datetime = UNSET
        else:
            due_datetime = self.due_datetime

        external_project_id: Unset | str | None
        if isinstance(self.external_project_id, Unset):
            external_project_id = UNSET
        else:
            external_project_id = self.external_project_id

        external_project_name: Unset | str | None
        if isinstance(self.external_project_name, Unset):
            external_project_name = UNSET
        else:
            external_project_name = self.external_project_name

        labels: Unset | str | None
        if isinstance(self.labels, Unset):
            labels = UNSET
        else:
            labels = self.labels

        url: Unset | str | None
        if isinstance(self.url, Unset):
            url = UNSET
        else:
            url = self.url

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "connectionId": connection_id,
                "externalId": external_id,
                "sourceProvider": source_provider,
                "title": title,
            }
        )
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if description is not UNSET:
            field_dict["description"] = description
        if is_completed is not UNSET:
            field_dict["isCompleted"] = is_completed
        if priority is not UNSET:
            field_dict["priority"] = priority
        if due_date is not UNSET:
            field_dict["dueDate"] = due_date
        if due_datetime is not UNSET:
            field_dict["dueDatetime"] = due_datetime
        if external_project_id is not UNSET:
            field_dict["externalProjectId"] = external_project_id
        if external_project_name is not UNSET:
            field_dict["externalProjectName"] = external_project_name
        if labels is not UNSET:
            field_dict["labels"] = labels
        if url is not UNSET:
            field_dict["url"] = url
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        connection_id = d.pop("connectionId")

        external_id = d.pop("externalId")

        source_provider = d.pop("sourceProvider")

        title = d.pop("title")

        ecosystem_id = d.pop("ecosystemId", UNSET)

        def _parse_description(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        description = _parse_description(d.pop("description", UNSET))

        is_completed = d.pop("isCompleted", UNSET)

        priority = d.pop("priority", UNSET)

        def _parse_due_date(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        due_date = _parse_due_date(d.pop("dueDate", UNSET))

        def _parse_due_datetime(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        due_datetime = _parse_due_datetime(d.pop("dueDatetime", UNSET))

        def _parse_external_project_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        external_project_id = _parse_external_project_id(d.pop("externalProjectId", UNSET))

        def _parse_external_project_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        external_project_name = _parse_external_project_name(d.pop("externalProjectName", UNSET))

        def _parse_labels(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        labels = _parse_labels(d.pop("labels", UNSET))

        def _parse_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        url = _parse_url(d.pop("url", UNSET))

        sync_txid = d.pop("syncTxid", UNSET)

        post_project_tasks_body = cls(
            connection_id=connection_id,
            external_id=external_id,
            source_provider=source_provider,
            title=title,
            ecosystem_id=ecosystem_id,
            description=description,
            is_completed=is_completed,
            priority=priority,
            due_date=due_date,
            due_datetime=due_datetime,
            external_project_id=external_project_id,
            external_project_name=external_project_name,
            labels=labels,
            url=url,
            sync_txid=sync_txid,
        )

        return post_project_tasks_body
