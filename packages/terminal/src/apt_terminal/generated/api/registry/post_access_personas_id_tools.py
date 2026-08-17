from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.post_access_personas_id_tools_body import PostAccessPersonasIdToolsBody
from ...models.post_access_personas_id_tools_response_201 import (
    PostAccessPersonasIdToolsResponse201,
)
from ...types import Response


def _get_kwargs(
    id: str,
    *,
    body: PostAccessPersonasIdToolsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/access/personas/{id}/tools",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | PostAccessPersonasIdToolsResponse201 | None:
    if response.status_code == 201:
        response_201 = PostAccessPersonasIdToolsResponse201.from_dict(response.json())

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
) -> Response[Error | PostAccessPersonasIdToolsResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostAccessPersonasIdToolsBody,
) -> Response[Error | PostAccessPersonasIdToolsResponse201]:
    """Grant a tool to a persona (owner/admin)

    Args:
        id (str):
        body (PostAccessPersonasIdToolsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, PostAccessPersonasIdToolsResponse201]]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostAccessPersonasIdToolsBody,
) -> Error | PostAccessPersonasIdToolsResponse201 | None:
    """Grant a tool to a persona (owner/admin)

    Args:
        id (str):
        body (PostAccessPersonasIdToolsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, PostAccessPersonasIdToolsResponse201]
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostAccessPersonasIdToolsBody,
) -> Response[Error | PostAccessPersonasIdToolsResponse201]:
    """Grant a tool to a persona (owner/admin)

    Args:
        id (str):
        body (PostAccessPersonasIdToolsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, PostAccessPersonasIdToolsResponse201]]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient,
    body: PostAccessPersonasIdToolsBody,
) -> Error | PostAccessPersonasIdToolsResponse201 | None:
    """Grant a tool to a persona (owner/admin)

    Args:
        id (str):
        body (PostAccessPersonasIdToolsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, PostAccessPersonasIdToolsResponse201]
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
