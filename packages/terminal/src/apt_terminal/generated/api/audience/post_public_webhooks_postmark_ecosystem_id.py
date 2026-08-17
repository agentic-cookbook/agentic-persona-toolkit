from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.post_public_webhooks_postmark_ecosystem_id_response_200 import (
    PostPublicWebhooksPostmarkEcosystemIdResponse200,
)
from ...models.postmark_deliverability_event import PostmarkDeliverabilityEvent
from ...types import Response


def _get_kwargs(
    ecosystem_id: str,
    *,
    body: PostmarkDeliverabilityEvent,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/public/webhooks/postmark/{ecosystem_id}",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | PostPublicWebhooksPostmarkEcosystemIdResponse200 | None:
    if response.status_code == 200:
        response_200 = PostPublicWebhooksPostmarkEcosystemIdResponse200.from_dict(response.json())

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

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Error | PostPublicWebhooksPostmarkEcosystemIdResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    ecosystem_id: str,
    *,
    client: AuthenticatedClient | Client,
    body: PostmarkDeliverabilityEvent,
) -> Response[Error | PostPublicWebhooksPostmarkEcosystemIdResponse200]:
    """Deliverability events from Postmark (per-ecosystem secret header, not a JWT)

    Args:
        ecosystem_id (str):
        body (PostmarkDeliverabilityEvent):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, PostPublicWebhooksPostmarkEcosystemIdResponse200]]
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
    client: AuthenticatedClient | Client,
    body: PostmarkDeliverabilityEvent,
) -> Error | PostPublicWebhooksPostmarkEcosystemIdResponse200 | None:
    """Deliverability events from Postmark (per-ecosystem secret header, not a JWT)

    Args:
        ecosystem_id (str):
        body (PostmarkDeliverabilityEvent):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, PostPublicWebhooksPostmarkEcosystemIdResponse200]
    """

    return sync_detailed(
        ecosystem_id=ecosystem_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    ecosystem_id: str,
    *,
    client: AuthenticatedClient | Client,
    body: PostmarkDeliverabilityEvent,
) -> Response[Error | PostPublicWebhooksPostmarkEcosystemIdResponse200]:
    """Deliverability events from Postmark (per-ecosystem secret header, not a JWT)

    Args:
        ecosystem_id (str):
        body (PostmarkDeliverabilityEvent):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, PostPublicWebhooksPostmarkEcosystemIdResponse200]]
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
    client: AuthenticatedClient | Client,
    body: PostmarkDeliverabilityEvent,
) -> Error | PostPublicWebhooksPostmarkEcosystemIdResponse200 | None:
    """Deliverability events from Postmark (per-ecosystem secret header, not a JWT)

    Args:
        ecosystem_id (str):
        body (PostmarkDeliverabilityEvent):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, PostPublicWebhooksPostmarkEcosystemIdResponse200]
    """

    return (
        await asyncio_detailed(
            ecosystem_id=ecosystem_id,
            client=client,
            body=body,
        )
    ).parsed
