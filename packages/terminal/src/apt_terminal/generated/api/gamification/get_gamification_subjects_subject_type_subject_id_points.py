from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.gamification_points_page import GamificationPointsPage
from ...types import UNSET, Response, Unset


def _get_kwargs(
    subject_type: str,
    subject_id: str,
    *,
    page: Unset | str = UNSET,
    page_size: Unset | str = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["page"] = page

    params["pageSize"] = page_size

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/gamification/subjects/{subject_type}/{subject_id}/points",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | GamificationPointsPage | None:
    if response.status_code == 200:
        response_200 = GamificationPointsPage.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Error | GamificationPointsPage]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    subject_type: str,
    subject_id: str,
    *,
    client: AuthenticatedClient,
    page: Unset | str = UNSET,
    page_size: Unset | str = UNSET,
) -> Response[Error | GamificationPointsPage]:
    """A subject’s point ledger (newest first)

    Args:
        subject_type (str):
        subject_id (str):
        page (Union[Unset, str]):
        page_size (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, GamificationPointsPage]]
    """

    kwargs = _get_kwargs(
        subject_type=subject_type,
        subject_id=subject_id,
        page=page,
        page_size=page_size,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    subject_type: str,
    subject_id: str,
    *,
    client: AuthenticatedClient,
    page: Unset | str = UNSET,
    page_size: Unset | str = UNSET,
) -> Error | GamificationPointsPage | None:
    """A subject’s point ledger (newest first)

    Args:
        subject_type (str):
        subject_id (str):
        page (Union[Unset, str]):
        page_size (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, GamificationPointsPage]
    """

    return sync_detailed(
        subject_type=subject_type,
        subject_id=subject_id,
        client=client,
        page=page,
        page_size=page_size,
    ).parsed


async def asyncio_detailed(
    subject_type: str,
    subject_id: str,
    *,
    client: AuthenticatedClient,
    page: Unset | str = UNSET,
    page_size: Unset | str = UNSET,
) -> Response[Error | GamificationPointsPage]:
    """A subject’s point ledger (newest first)

    Args:
        subject_type (str):
        subject_id (str):
        page (Union[Unset, str]):
        page_size (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, GamificationPointsPage]]
    """

    kwargs = _get_kwargs(
        subject_type=subject_type,
        subject_id=subject_id,
        page=page,
        page_size=page_size,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    subject_type: str,
    subject_id: str,
    *,
    client: AuthenticatedClient,
    page: Unset | str = UNSET,
    page_size: Unset | str = UNSET,
) -> Error | GamificationPointsPage | None:
    """A subject’s point ledger (newest first)

    Args:
        subject_type (str):
        subject_id (str):
        page (Union[Unset, str]):
        page_size (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, GamificationPointsPage]
    """

    return (
        await asyncio_detailed(
            subject_type=subject_type,
            subject_id=subject_id,
            client=client,
            page=page,
            page_size=page_size,
        )
    ).parsed
