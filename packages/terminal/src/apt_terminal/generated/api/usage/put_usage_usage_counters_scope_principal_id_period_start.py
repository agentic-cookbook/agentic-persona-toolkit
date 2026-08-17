from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.put_usage_usage_counters_scope_principal_id_period_start_body import (
    PutUsageUsageCountersScopePrincipalIdPeriodStartBody,
)
from ...models.put_usage_usage_counters_scope_principal_id_period_start_response_200 import (
    PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200,
)
from ...types import Response


def _get_kwargs(
    scope: str,
    principal_id: str,
    period_start: str,
    *,
    body: PutUsageUsageCountersScopePrincipalIdPeriodStartBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": f"/usage/usage-counters/{scope}/{principal_id}/{period_start}",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200 | None:
    if response.status_code == 200:
        response_200 = PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200.from_dict(
            response.json()
        )

        return response_200

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
) -> Response[Error | PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    scope: str,
    principal_id: str,
    period_start: str,
    *,
    client: AuthenticatedClient,
    body: PutUsageUsageCountersScopePrincipalIdPeriodStartBody,
) -> Response[Error | PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200]:
    """Update usage_counters

    Args:
        scope (str):
        principal_id (str):
        period_start (str):
        body (PutUsageUsageCountersScopePrincipalIdPeriodStartBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200]]
    """

    kwargs = _get_kwargs(
        scope=scope,
        principal_id=principal_id,
        period_start=period_start,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    scope: str,
    principal_id: str,
    period_start: str,
    *,
    client: AuthenticatedClient,
    body: PutUsageUsageCountersScopePrincipalIdPeriodStartBody,
) -> Error | PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200 | None:
    """Update usage_counters

    Args:
        scope (str):
        principal_id (str):
        period_start (str):
        body (PutUsageUsageCountersScopePrincipalIdPeriodStartBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200]
    """

    return sync_detailed(
        scope=scope,
        principal_id=principal_id,
        period_start=period_start,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    scope: str,
    principal_id: str,
    period_start: str,
    *,
    client: AuthenticatedClient,
    body: PutUsageUsageCountersScopePrincipalIdPeriodStartBody,
) -> Response[Error | PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200]:
    """Update usage_counters

    Args:
        scope (str):
        principal_id (str):
        period_start (str):
        body (PutUsageUsageCountersScopePrincipalIdPeriodStartBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200]]
    """

    kwargs = _get_kwargs(
        scope=scope,
        principal_id=principal_id,
        period_start=period_start,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    scope: str,
    principal_id: str,
    period_start: str,
    *,
    client: AuthenticatedClient,
    body: PutUsageUsageCountersScopePrincipalIdPeriodStartBody,
) -> Error | PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200 | None:
    """Update usage_counters

    Args:
        scope (str):
        principal_id (str):
        period_start (str):
        body (PutUsageUsageCountersScopePrincipalIdPeriodStartBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, PutUsageUsageCountersScopePrincipalIdPeriodStartResponse200]
    """

    return (
        await asyncio_detailed(
            scope=scope,
            principal_id=principal_id,
            period_start=period_start,
            client=client,
            body=body,
        )
    ).parsed
