from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.persona_service_model_type_1 import PersonaServiceModelType1


T = TypeVar("T", bound="PersonaService")


@_attrs_define
class PersonaService:
    """
    Attributes:
        id (str):
        provider_kind (str):
        name (str):
        base_url (str):
        has_api_key (bool):
        connect_status (str):
        models (list[Union['PersonaServiceModelType1', str]]):
        template_id (Union[None, Unset, str]):
        connect_error (Union[None, Unset, str]):
        last_connected_at (Union[None, Unset, str]):
        documentation_url (Union[None, Unset, str]):
        status_url (Union[None, Unset, str]):
        models_fetched_at (Union[None, Unset, str]):
    """

    id: str
    provider_kind: str
    name: str
    base_url: str
    has_api_key: bool
    connect_status: str
    models: list[Union["PersonaServiceModelType1", str]]
    template_id: None | Unset | str = UNSET
    connect_error: None | Unset | str = UNSET
    last_connected_at: None | Unset | str = UNSET
    documentation_url: None | Unset | str = UNSET
    status_url: None | Unset | str = UNSET
    models_fetched_at: None | Unset | str = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.persona_service_model_type_1 import PersonaServiceModelType1

        id = self.id

        provider_kind = self.provider_kind

        name = self.name

        base_url = self.base_url

        has_api_key = self.has_api_key

        connect_status = self.connect_status

        models = []
        for models_item_data in self.models:
            models_item: dict[str, Any] | str
            if isinstance(models_item_data, PersonaServiceModelType1):
                models_item = models_item_data.to_dict()
            else:
                models_item = models_item_data
            models.append(models_item)

        template_id: Unset | str | None
        if isinstance(self.template_id, Unset):
            template_id = UNSET
        else:
            template_id = self.template_id

        connect_error: Unset | str | None
        if isinstance(self.connect_error, Unset):
            connect_error = UNSET
        else:
            connect_error = self.connect_error

        last_connected_at: Unset | str | None
        if isinstance(self.last_connected_at, Unset):
            last_connected_at = UNSET
        else:
            last_connected_at = self.last_connected_at

        documentation_url: Unset | str | None
        if isinstance(self.documentation_url, Unset):
            documentation_url = UNSET
        else:
            documentation_url = self.documentation_url

        status_url: Unset | str | None
        if isinstance(self.status_url, Unset):
            status_url = UNSET
        else:
            status_url = self.status_url

        models_fetched_at: Unset | str | None
        if isinstance(self.models_fetched_at, Unset):
            models_fetched_at = UNSET
        else:
            models_fetched_at = self.models_fetched_at

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "providerKind": provider_kind,
                "name": name,
                "baseUrl": base_url,
                "hasApiKey": has_api_key,
                "connectStatus": connect_status,
                "models": models,
            }
        )
        if template_id is not UNSET:
            field_dict["templateId"] = template_id
        if connect_error is not UNSET:
            field_dict["connectError"] = connect_error
        if last_connected_at is not UNSET:
            field_dict["lastConnectedAt"] = last_connected_at
        if documentation_url is not UNSET:
            field_dict["documentationUrl"] = documentation_url
        if status_url is not UNSET:
            field_dict["statusUrl"] = status_url
        if models_fetched_at is not UNSET:
            field_dict["modelsFetchedAt"] = models_fetched_at

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.persona_service_model_type_1 import PersonaServiceModelType1

        d = dict(src_dict)
        id = d.pop("id")

        provider_kind = d.pop("providerKind")

        name = d.pop("name")

        base_url = d.pop("baseUrl")

        has_api_key = d.pop("hasApiKey")

        connect_status = d.pop("connectStatus")

        models = []
        _models = d.pop("models")
        for models_item_data in _models:

            def _parse_models_item(data: object) -> Union["PersonaServiceModelType1", str]:
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_persona_service_model_type_1 = (
                        PersonaServiceModelType1.from_dict(data)
                    )

                    return componentsschemas_persona_service_model_type_1
                except:  # noqa: E722
                    pass
                return cast(Union["PersonaServiceModelType1", str], data)

            models_item = _parse_models_item(models_item_data)

            models.append(models_item)

        def _parse_template_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        template_id = _parse_template_id(d.pop("templateId", UNSET))

        def _parse_connect_error(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        connect_error = _parse_connect_error(d.pop("connectError", UNSET))

        def _parse_last_connected_at(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        last_connected_at = _parse_last_connected_at(d.pop("lastConnectedAt", UNSET))

        def _parse_documentation_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        documentation_url = _parse_documentation_url(d.pop("documentationUrl", UNSET))

        def _parse_status_url(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        status_url = _parse_status_url(d.pop("statusUrl", UNSET))

        def _parse_models_fetched_at(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        models_fetched_at = _parse_models_fetched_at(d.pop("modelsFetchedAt", UNSET))

        persona_service = cls(
            id=id,
            provider_kind=provider_kind,
            name=name,
            base_url=base_url,
            has_api_key=has_api_key,
            connect_status=connect_status,
            models=models,
            template_id=template_id,
            connect_error=connect_error,
            last_connected_at=last_connected_at,
            documentation_url=documentation_url,
            status_url=status_url,
            models_fetched_at=models_fetched_at,
        )

        persona_service.additional_properties = d
        return persona_service

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
