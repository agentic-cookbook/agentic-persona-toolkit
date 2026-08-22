from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.delete_project_projects_id_milestones_milestone_id_response_200 import (
    DeleteProjectProjectsIdMilestonesMilestoneIdResponse200,
)
from ...models.error import Error
from ...types import Response


def _get_kwargs(
    id: str,
    milestone_id: str,
) -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": f"/project/projects/{id}/milestones/{milestone_id}",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> DeleteProjectProjectsIdMilestonesMilestoneIdResponse200 | Error | None:
    if response.status_code == 200:
        response_200 = DeleteProjectProjectsIdMilestonesMilestoneIdResponse200.from_dict(
            response.json()
        )

        return response_200

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
) -> Response[DeleteProjectProjectsIdMilestonesMilestoneIdResponse200 | Error]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    milestone_id: str,
    *,
    client: AuthenticatedClient,
) -> Response[DeleteProjectProjectsIdMilestonesMilestoneIdResponse200 | Error]:
    r"""Soft-delete a milestone, UN-ASSIGNING its cards (+ a milestone.deleted activity)

     The iteration-delete rule at project scope: `milestoneId` is nullable and \"counts toward no
    milestone\" is an ordinary state, so this always succeeds and the cards are detached rather than
    deleted. The sweep is bounded to THIS project — a milestone’s cards cannot be anywhere else — which
    also keeps it from touching a row the caller’s D verb here does not cover. Requires the project’s
    projects sub-item D verb.

    Args:
        id (str):
        milestone_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[DeleteProjectProjectsIdMilestonesMilestoneIdResponse200, Error]]
    """

    kwargs = _get_kwargs(
        id=id,
        milestone_id=milestone_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: str,
    milestone_id: str,
    *,
    client: AuthenticatedClient,
) -> DeleteProjectProjectsIdMilestonesMilestoneIdResponse200 | Error | None:
    r"""Soft-delete a milestone, UN-ASSIGNING its cards (+ a milestone.deleted activity)

     The iteration-delete rule at project scope: `milestoneId` is nullable and \"counts toward no
    milestone\" is an ordinary state, so this always succeeds and the cards are detached rather than
    deleted. The sweep is bounded to THIS project — a milestone’s cards cannot be anywhere else — which
    also keeps it from touching a row the caller’s D verb here does not cover. Requires the project’s
    projects sub-item D verb.

    Args:
        id (str):
        milestone_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[DeleteProjectProjectsIdMilestonesMilestoneIdResponse200, Error]
    """

    return sync_detailed(
        id=id,
        milestone_id=milestone_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    id: str,
    milestone_id: str,
    *,
    client: AuthenticatedClient,
) -> Response[DeleteProjectProjectsIdMilestonesMilestoneIdResponse200 | Error]:
    r"""Soft-delete a milestone, UN-ASSIGNING its cards (+ a milestone.deleted activity)

     The iteration-delete rule at project scope: `milestoneId` is nullable and \"counts toward no
    milestone\" is an ordinary state, so this always succeeds and the cards are detached rather than
    deleted. The sweep is bounded to THIS project — a milestone’s cards cannot be anywhere else — which
    also keeps it from touching a row the caller’s D verb here does not cover. Requires the project’s
    projects sub-item D verb.

    Args:
        id (str):
        milestone_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[DeleteProjectProjectsIdMilestonesMilestoneIdResponse200, Error]]
    """

    kwargs = _get_kwargs(
        id=id,
        milestone_id=milestone_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: str,
    milestone_id: str,
    *,
    client: AuthenticatedClient,
) -> DeleteProjectProjectsIdMilestonesMilestoneIdResponse200 | Error | None:
    r"""Soft-delete a milestone, UN-ASSIGNING its cards (+ a milestone.deleted activity)

     The iteration-delete rule at project scope: `milestoneId` is nullable and \"counts toward no
    milestone\" is an ordinary state, so this always succeeds and the cards are detached rather than
    deleted. The sweep is bounded to THIS project — a milestone’s cards cannot be anywhere else — which
    also keeps it from touching a row the caller’s D verb here does not cover. Requires the project’s
    projects sub-item D verb.

    Args:
        id (str):
        milestone_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[DeleteProjectProjectsIdMilestonesMilestoneIdResponse200, Error]
    """

    return (
        await asyncio_detailed(
            id=id,
            milestone_id=milestone_id,
            client=client,
        )
    ).parsed
