from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.eco_managed_row import EcoManagedRow
from ...models.eco_send_invites_body import EcoSendInvitesBody
from ...models.error import Error
from ...types import Response


def _get_kwargs(
    ecosystem_id: str,
    *,
    body: EcoSendInvitesBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/auth/ecosystems/{ecosystem_id}/invitations",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | list["EcoManagedRow"] | None:
    if response.status_code == 201:
        response_201 = []
        _response_201 = response.json()
        for componentsschemas_eco_managed_row_list_item_data in _response_201:
            componentsschemas_eco_managed_row_list_item = EcoManagedRow.from_dict(
                componentsschemas_eco_managed_row_list_item_data
            )

            response_201.append(componentsschemas_eco_managed_row_list_item)

        return response_201

    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401

    if response.status_code == 403:
        response_403 = Error.from_dict(response.json())

        return response_403

    if response.status_code == 404:
        response_404 = Error.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Error | list["EcoManagedRow"]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    ecosystem_id: str,
    *,
    client: AuthenticatedClient,
    body: EcoSendInvitesBody,
) -> Response[Error | list["EcoManagedRow"]]:
    """Send invitations (email/SMS) for an ecosystem (owner-scoped)

    Args:
        ecosystem_id (str):
        body (EcoSendInvitesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['EcoManagedRow']]]
    """

    kwargs = _get_kwargs(
        ecosystem_id=ecosystem_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    ecosystem_id: str,
    *,
    client: AuthenticatedClient,
    body: EcoSendInvitesBody,
) -> Error | list["EcoManagedRow"] | None:
    """Send invitations (email/SMS) for an ecosystem (owner-scoped)

    Args:
        ecosystem_id (str):
        body (EcoSendInvitesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['EcoManagedRow']]
    """

    return sync_detailed(
        ecosystem_id=ecosystem_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    ecosystem_id: str,
    *,
    client: AuthenticatedClient,
    body: EcoSendInvitesBody,
) -> Response[Error | list["EcoManagedRow"]]:
    """Send invitations (email/SMS) for an ecosystem (owner-scoped)

    Args:
        ecosystem_id (str):
        body (EcoSendInvitesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['EcoManagedRow']]]
    """

    kwargs = _get_kwargs(
        ecosystem_id=ecosystem_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    ecosystem_id: str,
    *,
    client: AuthenticatedClient,
    body: EcoSendInvitesBody,
) -> Error | list["EcoManagedRow"] | None:
    """Send invitations (email/SMS) for an ecosystem (owner-scoped)

    Args:
        ecosystem_id (str):
        body (EcoSendInvitesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['EcoManagedRow']]
    """

    return (
        await asyncio_detailed(
            ecosystem_id=ecosystem_id,
            client=client,
            body=body,
        )
    ).parsed
