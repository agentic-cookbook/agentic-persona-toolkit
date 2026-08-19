from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PutIntegrationIntegrationCalendarEventsIdBody")


@_attrs_define
class PutIntegrationIntegrationCalendarEventsIdBody:
    """
    Attributes:
        title (Union[Unset, str]):
        description (Union[None, Unset, str]):
        start_time (Union[None, Unset, str]):
        end_time (Union[None, Unset, str]):
        start_date (Union[None, Unset, str]):
        end_date (Union[None, Unset, str]):
        is_all_day (Union[Unset, bool]):
        location (Union[None, Unset, str]):
        source (Union[Unset, str]):
        external_id (Union[Unset, str]):
        connection_id (Union[None, Unset, str]):
        calendar_name (Union[None, Unset, str]):
        calendar_color (Union[None, Unset, str]):
        status (Union[Unset, str]):
        organizer (Union[None, Unset, str]):
        attendees (Union[None, Unset, str]):
        reminders (Union[None, Unset, str]):
        url (Union[None, Unset, str]):
        ai_extraction (Union[None, Unset, str]):
        ecosystem_id (Union[Unset, str]):
        sync_txid (Union[Unset, int]):
    """

    title: Unset | str = UNSET
    description: None | Unset | str = UNSET
    start_time: None | Unset | str = UNSET
    end_time: None | Unset | str = UNSET
    start_date: None | Unset | str = UNSET
    end_date: None | Unset | str = UNSET
    is_all_day: Unset | bool = UNSET
    location: None | Unset | str = UNSET
    source: Unset | str = UNSET
    external_id: Unset | str = UNSET
    connection_id: None | Unset | str = UNSET
    calendar_name: None | Unset | str = UNSET
    calendar_color: None | Unset | str = UNSET
    status: Unset | str = UNSET
    organizer: None | Unset | str = UNSET
    attendees: None | Unset | str = UNSET
    reminders: None | Unset | str = UNSET
    url: None | Unset | str = UNSET
    ai_extraction: None | Unset | str = UNSET
    ecosystem_id: Unset | str = UNSET
    sync_txid: Unset | int = UNSET

    def to_dict(self) -> dict[str, Any]:
        title = self.title

        description: Unset | str | None
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        start_time: Unset | str | None
        if isinstance(self.start_time, Unset):
            start_time = UNSET
        else:
            start_time = self.start_time

        end_time: Unset | str | None
        if isinstance(self.end_time, Unset):
            end_time = UNSET
        else:
            end_time = self.end_time

        start_date: Unset | str | None
        if isinstance(self.start_date, Unset):
            start_date = UNSET
        else:
            start_date = self.start_date

        end_date: Unset | str | None
        if isinstance(self.end_date, Unset):
            end_date = UNSET
        else:
            end_date = self.end_date

        is_all_day = self.is_all_day

        location: Unset | str | None
        if isinstance(self.location, Unset):
            location = UNSET
        else:
            location = self.location

        source = self.source

        external_id = self.external_id

        connection_id: Unset | str | None
        if isinstance(self.connection_id, Unset):
            connection_id = UNSET
        else:
            connection_id = self.connection_id

        calendar_name: Unset | str | None
        if isinstance(self.calendar_name, Unset):
            calendar_name = UNSET
        else:
            calendar_name = self.calendar_name

        calendar_color: Unset | str | None
        if isinstance(self.calendar_color, Unset):
            calendar_color = UNSET
        else:
            calendar_color = self.calendar_color

        status = self.status

        organizer: Unset | str | None
        if isinstance(self.organizer, Unset):
            organizer = UNSET
        else:
            organizer = self.organizer

        attendees: Unset | str | None
        if isinstance(self.attendees, Unset):
            attendees = UNSET
        else:
            attendees = self.attendees

        reminders: Unset | str | None
        if isinstance(self.reminders, Unset):
            reminders = UNSET
        else:
            reminders = self.reminders

        url: Unset | str | None
        if isinstance(self.url, Unset):
            url = UNSET
        else:
            url = self.url

        ai_extraction: Unset | str | None
        if isinstance(self.ai_extraction, Unset):
            ai_extraction = UNSET
        else:
            ai_extraction = self.ai_extraction

        ecosystem_id = self.ecosystem_id

        sync_txid = self.sync_txid

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if title is not UNSET:
            field_dict["title"] = title
        if description is not UNSET:
            field_dict["description"] = description
        if start_time is not UNSET:
            field_dict["startTime"] = start_time
        if end_time is not UNSET:
            field_dict["endTime"] = end_time
        if start_date is not UNSET:
            field_dict["startDate"] = start_date
        if end_date is not UNSET:
            field_dict["endDate"] = end_date
        if is_all_day is not UNSET:
            field_dict["isAllDay"] = is_all_day
        if location is not UNSET:
            field_dict["location"] = location
        if source is not UNSET:
            field_dict["source"] = source
        if external_id is not UNSET:
            field_dict["externalId"] = external_id
        if connection_id is not UNSET:
            field_dict["connectionId"] = connection_id
        if calendar_name is not UNSET:
            field_dict["calendarName"] = calendar_name
        if calendar_color is not UNSET:
            field_dict["calendarColor"] = calendar_color
        if status is not UNSET:
            field_dict["status"] = status
        if organizer is not UNSET:
            field_dict["organizer"] = organizer
        if attendees is not UNSET:
            field_dict["attendees"] = attendees
        if reminders is not UNSET:
            field_dict["reminders"] = reminders
        if url is not UNSET:
            field_dict["url"] = url
        if ai_extraction is not UNSET:
            field_dict["aiExtraction"] = ai_extraction
        if ecosystem_id is not UNSET:
            field_dict["ecosystemId"] = ecosystem_id
        if sync_txid is not UNSET:
            field_dict["syncTxid"] = sync_txid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        title = d.pop("title", UNSET)

        def _parse_description(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        description = _parse_description(d.pop("description", UNSET))

        def _parse_start_time(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        start_time = _parse_start_time(d.pop("startTime", UNSET))

        def _parse_end_time(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        end_time = _parse_end_time(d.pop("endTime", UNSET))

        def _parse_start_date(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        start_date = _parse_start_date(d.pop("startDate", UNSET))

        def _parse_end_date(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        end_date = _parse_end_date(d.pop("endDate", UNSET))

        is_all_day = d.pop("isAllDay", UNSET)

        def _parse_location(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        location = _parse_location(d.pop("location", UNSET))

        source = d.pop("source", UNSET)

        external_id = d.pop("externalId", UNSET)

        def _parse_connection_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        connection_id = _parse_connection_id(d.pop("connectionId", UNSET))

        def _parse_calendar_name(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        calendar_name = _parse_calendar_name(d.pop("calendarName", UNSET))

        def _parse_calendar_color(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        calendar_color = _parse_calendar_color(d.pop("calendarColor", UNSET))

        status = d.pop("status", UNSET)

        def _parse_organizer(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        organizer = _parse_organizer(d.pop("organizer", UNSET))

        def _parse_attendees(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        attendees = _parse_attendees(d.pop("attendees", UNSET))

        def _parse_reminders(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        reminders = _parse_reminders(d.pop("reminders", UNSET))

        def _parse_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        url = _parse_url(d.pop("url", UNSET))

        def _parse_ai_extraction(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        ai_extraction = _parse_ai_extraction(d.pop("aiExtraction", UNSET))

        ecosystem_id = d.pop("ecosystemId", UNSET)

        sync_txid = d.pop("syncTxid", UNSET)

        put_integration_integration_calendar_events_id_body = cls(
            title=title,
            description=description,
            start_time=start_time,
            end_time=end_time,
            start_date=start_date,
            end_date=end_date,
            is_all_day=is_all_day,
            location=location,
            source=source,
            external_id=external_id,
            connection_id=connection_id,
            calendar_name=calendar_name,
            calendar_color=calendar_color,
            status=status,
            organizer=organizer,
            attendees=attendees,
            reminders=reminders,
            url=url,
            ai_extraction=ai_extraction,
            ecosystem_id=ecosystem_id,
            sync_txid=sync_txid,
        )

        return put_integration_integration_calendar_events_id_body
