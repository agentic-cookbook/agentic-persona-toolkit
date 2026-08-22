from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.put_persona_personas_id_body_canned_chat_type_0_type_1 import (
        PutPersonaPersonasIdBodyCannedChatType0Type1,
    )
    from ..models.put_persona_personas_id_body_chat_status_type_0_type_1 import (
        PutPersonaPersonasIdBodyChatStatusType0Type1,
    )


T = TypeVar("T", bound="PutPersonaPersonasIdBody")


@_attrs_define
class PutPersonaPersonasIdBody:
    """
    Attributes:
        slug (Union[Unset, str]):
        name (Union[Unset, str]):
        description (Union[None, Unset, str]):
        visibility (Union[Unset, str]):
        model (Union[Unset, str]):
        service_id (Union[None, Unset, str]):
        app_id (Union[None, Unset, str]):
        avatar_attachment_id (Union[None, Unset, str]):
        model_prompt (Union[Unset, str]):
        voice (Union[None, Unset, str]):
        character (Union[None, Unset, str]):
        examples (Union[None, Unset, str]):
        canned_chat (Union['PutPersonaPersonasIdBodyCannedChatType0Type1', None, Unset, bool, float, list[Any], str]):
        chat_status (Union['PutPersonaPersonasIdBodyChatStatusType0Type1', None, Unset, bool, float, list[Any], str]):
    """

    slug: Unset | str = UNSET
    name: Unset | str = UNSET
    description: None | Unset | str = UNSET
    visibility: Unset | str = UNSET
    model: Unset | str = UNSET
    service_id: None | Unset | str = UNSET
    app_id: None | Unset | str = UNSET
    avatar_attachment_id: None | Unset | str = UNSET
    model_prompt: Unset | str = UNSET
    voice: None | Unset | str = UNSET
    character: None | Unset | str = UNSET
    examples: None | Unset | str = UNSET
    canned_chat: Union[
        "PutPersonaPersonasIdBodyCannedChatType0Type1", None, Unset, bool, float, list[Any], str
    ] = UNSET
    chat_status: Union[
        "PutPersonaPersonasIdBodyChatStatusType0Type1", None, Unset, bool, float, list[Any], str
    ] = UNSET

    def to_dict(self) -> dict[str, Any]:
        from ..models.put_persona_personas_id_body_canned_chat_type_0_type_1 import (
            PutPersonaPersonasIdBodyCannedChatType0Type1,
        )
        from ..models.put_persona_personas_id_body_chat_status_type_0_type_1 import (
            PutPersonaPersonasIdBodyChatStatusType0Type1,
        )

        slug = self.slug

        name = self.name

        description: None | Unset | str
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        visibility = self.visibility

        model = self.model

        service_id: None | Unset | str
        if isinstance(self.service_id, Unset):
            service_id = UNSET
        else:
            service_id = self.service_id

        app_id: None | Unset | str
        if isinstance(self.app_id, Unset):
            app_id = UNSET
        else:
            app_id = self.app_id

        avatar_attachment_id: None | Unset | str
        if isinstance(self.avatar_attachment_id, Unset):
            avatar_attachment_id = UNSET
        else:
            avatar_attachment_id = self.avatar_attachment_id

        model_prompt = self.model_prompt

        voice: None | Unset | str
        if isinstance(self.voice, Unset):
            voice = UNSET
        else:
            voice = self.voice

        character: None | Unset | str
        if isinstance(self.character, Unset):
            character = UNSET
        else:
            character = self.character

        examples: None | Unset | str
        if isinstance(self.examples, Unset):
            examples = UNSET
        else:
            examples = self.examples

        canned_chat: None | Unset | bool | dict[str, Any] | float | list[Any] | str
        if isinstance(self.canned_chat, Unset):
            canned_chat = UNSET
        elif isinstance(self.canned_chat, PutPersonaPersonasIdBodyCannedChatType0Type1):
            canned_chat = self.canned_chat.to_dict()
        elif isinstance(self.canned_chat, list):
            canned_chat = self.canned_chat

        else:
            canned_chat = self.canned_chat

        chat_status: None | Unset | bool | dict[str, Any] | float | list[Any] | str
        if isinstance(self.chat_status, Unset):
            chat_status = UNSET
        elif isinstance(self.chat_status, PutPersonaPersonasIdBodyChatStatusType0Type1):
            chat_status = self.chat_status.to_dict()
        elif isinstance(self.chat_status, list):
            chat_status = self.chat_status

        else:
            chat_status = self.chat_status

        field_dict: dict[str, Any] = {}

        field_dict.update({})
        if slug is not UNSET:
            field_dict["slug"] = slug
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if visibility is not UNSET:
            field_dict["visibility"] = visibility
        if model is not UNSET:
            field_dict["model"] = model
        if service_id is not UNSET:
            field_dict["serviceId"] = service_id
        if app_id is not UNSET:
            field_dict["appId"] = app_id
        if avatar_attachment_id is not UNSET:
            field_dict["avatarAttachmentId"] = avatar_attachment_id
        if model_prompt is not UNSET:
            field_dict["modelPrompt"] = model_prompt
        if voice is not UNSET:
            field_dict["voice"] = voice
        if character is not UNSET:
            field_dict["character"] = character
        if examples is not UNSET:
            field_dict["examples"] = examples
        if canned_chat is not UNSET:
            field_dict["cannedChat"] = canned_chat
        if chat_status is not UNSET:
            field_dict["chatStatus"] = chat_status

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_persona_personas_id_body_canned_chat_type_0_type_1 import (
            PutPersonaPersonasIdBodyCannedChatType0Type1,
        )
        from ..models.put_persona_personas_id_body_chat_status_type_0_type_1 import (
            PutPersonaPersonasIdBodyChatStatusType0Type1,
        )

        d = dict(src_dict)
        slug = d.pop("slug", UNSET)

        name = d.pop("name", UNSET)

        def _parse_description(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        description = _parse_description(d.pop("description", UNSET))

        visibility = d.pop("visibility", UNSET)

        model = d.pop("model", UNSET)

        def _parse_service_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        service_id = _parse_service_id(d.pop("serviceId", UNSET))

        def _parse_app_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        app_id = _parse_app_id(d.pop("appId", UNSET))

        def _parse_avatar_attachment_id(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        avatar_attachment_id = _parse_avatar_attachment_id(d.pop("avatarAttachmentId", UNSET))

        model_prompt = d.pop("modelPrompt", UNSET)

        def _parse_voice(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        voice = _parse_voice(d.pop("voice", UNSET))

        def _parse_character(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        character = _parse_character(d.pop("character", UNSET))

        def _parse_examples(data: object) -> None | Unset | str:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | Unset | str, data)

        examples = _parse_examples(d.pop("examples", UNSET))

        def _parse_canned_chat(
            data: object,
        ) -> Union[
            "PutPersonaPersonasIdBodyCannedChatType0Type1", None, Unset, bool, float, list[Any], str
        ]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                canned_chat_type_0_type_1 = PutPersonaPersonasIdBodyCannedChatType0Type1.from_dict(
                    data
                )

                return canned_chat_type_0_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                canned_chat_type_0_type_2 = cast(list[Any], data)

                return canned_chat_type_0_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union[
                    "PutPersonaPersonasIdBodyCannedChatType0Type1",
                    None,
                    Unset,
                    bool,
                    float,
                    list[Any],
                    str,
                ],
                data,
            )

        canned_chat = _parse_canned_chat(d.pop("cannedChat", UNSET))

        def _parse_chat_status(
            data: object,
        ) -> Union[
            "PutPersonaPersonasIdBodyChatStatusType0Type1", None, Unset, bool, float, list[Any], str
        ]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                chat_status_type_0_type_1 = PutPersonaPersonasIdBodyChatStatusType0Type1.from_dict(
                    data
                )

                return chat_status_type_0_type_1
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, list):
                    raise TypeError()
                chat_status_type_0_type_2 = cast(list[Any], data)

                return chat_status_type_0_type_2
            except:  # noqa: E722
                pass
            return cast(
                Union[
                    "PutPersonaPersonasIdBodyChatStatusType0Type1",
                    None,
                    Unset,
                    bool,
                    float,
                    list[Any],
                    str,
                ],
                data,
            )

        chat_status = _parse_chat_status(d.pop("chatStatus", UNSET))

        put_persona_personas_id_body = cls(
            slug=slug,
            name=name,
            description=description,
            visibility=visibility,
            model=model,
            service_id=service_id,
            app_id=app_id,
            avatar_attachment_id=avatar_attachment_id,
            model_prompt=model_prompt,
            voice=voice,
            character=character,
            examples=examples,
            canned_chat=canned_chat,
            chat_status=chat_status,
        )

        return put_persona_personas_id_body
