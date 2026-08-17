from http import HTTPStatus
from typing import Any, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.put_ecosystem_applications_app_id_schema_grants_body import (
    PutEcosystemApplicationsAppIdSchemaGrantsBody,
)
from ...types import Response


def _get_kwargs(
    app_id: str,
    *,
    body: PutEcosystemApplicationsAppIdSchemaGrantsBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": f"/ecosystem/applications/{app_id}/schema-grants",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | Error | None:
    if response.status_code == 204:
        response_204 = cast(Any, None)
        return response_204

    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400

    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401

    if response.status_code == 404:
        response_404 = Error.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Any | Error]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    app_id: str,
    *,
    client: AuthenticatedClient,
    body: PutEcosystemApplicationsAppIdSchemaGrantsBody,
) -> Response[Any | Error]:
    """Reconcile an application’s schema permissions

     Persists the app’s grants as per-app bucket access-groups. Buckets must belong to the app’s
    ecosystem (404 otherwise); each table must belong to its bucket.

    Args:
        app_id (str):
        body (PutEcosystemApplicationsAppIdSchemaGrantsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Error]]
    """

    kwargs = _get_kwargs(
        app_id=app_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    app_id: str,
    *,
    client: AuthenticatedClient,
    body: PutEcosystemApplicationsAppIdSchemaGrantsBody,
) -> Any | Error | None:
    """Reconcile an application’s schema permissions

     Persists the app’s grants as per-app bucket access-groups. Buckets must belong to the app’s
    ecosystem (404 otherwise); each table must belong to its bucket.

    Args:
        app_id (str):
        body (PutEcosystemApplicationsAppIdSchemaGrantsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Error]
    """

    return sync_detailed(
        app_id=app_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    app_id: str,
    *,
    client: AuthenticatedClient,
    body: PutEcosystemApplicationsAppIdSchemaGrantsBody,
) -> Response[Any | Error]:
    """Reconcile an application’s schema permissions

     Persists the app’s grants as per-app bucket access-groups. Buckets must belong to the app’s
    ecosystem (404 otherwise); each table must belong to its bucket.

    Args:
        app_id (str):
        body (PutEcosystemApplicationsAppIdSchemaGrantsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Error]]
    """

    kwargs = _get_kwargs(
        app_id=app_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    app_id: str,
    *,
    client: AuthenticatedClient,
    body: PutEcosystemApplicationsAppIdSchemaGrantsBody,
) -> Any | Error | None:
    """Reconcile an application’s schema permissions

     Persists the app’s grants as per-app bucket access-groups. Buckets must belong to the app’s
    ecosystem (404 otherwise); each table must belong to its bucket.

    Args:
        app_id (str):
        body (PutEcosystemApplicationsAppIdSchemaGrantsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Error]
    """

    return (
        await asyncio_detailed(
            app_id=app_id,
            client=client,
            body=body,
        )
    ).parsed
