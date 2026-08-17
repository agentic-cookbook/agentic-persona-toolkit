from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.patch_registry_registries_id_field_defs_field_id_body import (
    PatchRegistryRegistriesIdFieldDefsFieldIdBody,
)
from ...models.registry_field_def import RegistryFieldDef
from ...types import Response


def _get_kwargs(
    id: str,
    field_id: str,
    *,
    body: PatchRegistryRegistriesIdFieldDefsFieldIdBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": f"/registry/registries/{id}/field-defs/{field_id}",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | RegistryFieldDef | None:
    if response.status_code == 200:
        response_200 = RegistryFieldDef.from_dict(response.json())

        return response_200

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
) -> Response[Error | RegistryFieldDef]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    field_id: str,
    *,
    client: AuthenticatedClient,
    body: PatchRegistryRegistriesIdFieldDefsFieldIdBody,
) -> Response[Error | RegistryFieldDef]:
    """Update a field def (key/type immutable — a type change is a 400, a key change a no-op)

    Args:
        id (str):
        field_id (str):
        body (PatchRegistryRegistriesIdFieldDefsFieldIdBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, RegistryFieldDef]]
    """

    kwargs = _get_kwargs(
        id=id,
        field_id=field_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    field_id: str,
    *,
    client: AuthenticatedClient,
    body: PatchRegistryRegistriesIdFieldDefsFieldIdBody,
) -> Error | RegistryFieldDef | None:
    """Update a field def (key/type immutable — a type change is a 400, a key change a no-op)

    Args:
        id (str):
        field_id (str):
        body (PatchRegistryRegistriesIdFieldDefsFieldIdBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, RegistryFieldDef]
    """

    return sync_detailed(
        id=id,
        field_id=field_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: str,
    field_id: str,
    *,
    client: AuthenticatedClient,
    body: PatchRegistryRegistriesIdFieldDefsFieldIdBody,
) -> Response[Error | RegistryFieldDef]:
    """Update a field def (key/type immutable — a type change is a 400, a key change a no-op)

    Args:
        id (str):
        field_id (str):
        body (PatchRegistryRegistriesIdFieldDefsFieldIdBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, RegistryFieldDef]]
    """

    kwargs = _get_kwargs(
        id=id,
        field_id=field_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    field_id: str,
    *,
    client: AuthenticatedClient,
    body: PatchRegistryRegistriesIdFieldDefsFieldIdBody,
) -> Error | RegistryFieldDef | None:
    """Update a field def (key/type immutable — a type change is a 400, a key change a no-op)

    Args:
        id (str):
        field_id (str):
        body (PatchRegistryRegistriesIdFieldDefsFieldIdBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, RegistryFieldDef]
    """

    return (
        await asyncio_detailed(
            id=id,
            field_id=field_id,
            client=client,
            body=body,
        )
    ).parsed
