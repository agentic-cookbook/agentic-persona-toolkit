from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.post_processing_jobs_id_heartbeat_body import PostProcessingJobsIdHeartbeatBody
from ...models.post_processing_jobs_id_heartbeat_response_200 import (
    PostProcessingJobsIdHeartbeatResponse200,
)
from ...types import Response


def _get_kwargs(
    id: str,
    *,
    body: PostProcessingJobsIdHeartbeatBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/processing/jobs/{id}/heartbeat",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | PostProcessingJobsIdHeartbeatResponse200 | None:
    if response.status_code == 200:
        response_200 = PostProcessingJobsIdHeartbeatResponse200.from_dict(response.json())

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
) -> Response[Error | PostProcessingJobsIdHeartbeatResponse200]:
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
    body: PostProcessingJobsIdHeartbeatBody,
) -> Response[Error | PostProcessingJobsIdHeartbeatResponse200]:
    """Extend the lease on a claimed job

     Workers call this periodically while processing a slow job to prevent the reaper from reclaiming it.
    Returns 404 when the lease guard fails.

    Args:
        id (str):
        body (PostProcessingJobsIdHeartbeatBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, PostProcessingJobsIdHeartbeatResponse200]]
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
    body: PostProcessingJobsIdHeartbeatBody,
) -> Error | PostProcessingJobsIdHeartbeatResponse200 | None:
    """Extend the lease on a claimed job

     Workers call this periodically while processing a slow job to prevent the reaper from reclaiming it.
    Returns 404 when the lease guard fails.

    Args:
        id (str):
        body (PostProcessingJobsIdHeartbeatBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, PostProcessingJobsIdHeartbeatResponse200]
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
    body: PostProcessingJobsIdHeartbeatBody,
) -> Response[Error | PostProcessingJobsIdHeartbeatResponse200]:
    """Extend the lease on a claimed job

     Workers call this periodically while processing a slow job to prevent the reaper from reclaiming it.
    Returns 404 when the lease guard fails.

    Args:
        id (str):
        body (PostProcessingJobsIdHeartbeatBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, PostProcessingJobsIdHeartbeatResponse200]]
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
    body: PostProcessingJobsIdHeartbeatBody,
) -> Error | PostProcessingJobsIdHeartbeatResponse200 | None:
    """Extend the lease on a claimed job

     Workers call this periodically while processing a slow job to prevent the reaper from reclaiming it.
    Returns 404 when the lease guard fails.

    Args:
        id (str):
        body (PostProcessingJobsIdHeartbeatBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, PostProcessingJobsIdHeartbeatResponse200]
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
