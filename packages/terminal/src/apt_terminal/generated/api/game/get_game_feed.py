from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.get_game_feed_response_200 import GetGameFeedResponse200
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    game_id: Unset | str = UNSET,
    slug: Unset | str = UNSET,
    page: Unset | str = UNSET,
    page_size: Unset | str = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["game_id"] = game_id

    params["slug"] = slug

    params["page"] = page

    params["page_size"] = page_size

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/game/feed",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | GetGameFeedResponse200 | None:
    if response.status_code == 200:
        response_200 = GetGameFeedResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Error.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = Error.from_dict(response.json())

        return response_409

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Error | GetGameFeedResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    game_id: Unset | str = UNSET,
    slug: Unset | str = UNSET,
    page: Unset | str = UNSET,
    page_size: Unset | str = UNSET,
) -> Response[Error | GetGameFeedResponse200]:
    """One game’s public artifact feed (anonymous, read replica)

     The hot path, and it carries no `security`: it serves published artifacts to signed-out visitors and
    runs on the read replica so it does not contend with authenticated traffic. Three predicates are the
    entire boundary — `visibility = 'public'`, `deleted_at is null`, and `ecosystem_id`. The ecosystem
    is taken from the resolved game row, never from the query string. A retired game is 404.

    Args:
        game_id (Union[Unset, str]):
        slug (Union[Unset, str]):
        page (Union[Unset, str]):
        page_size (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, GetGameFeedResponse200]]
    """

    kwargs = _get_kwargs(
        game_id=game_id,
        slug=slug,
        page=page,
        page_size=page_size,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    game_id: Unset | str = UNSET,
    slug: Unset | str = UNSET,
    page: Unset | str = UNSET,
    page_size: Unset | str = UNSET,
) -> Error | GetGameFeedResponse200 | None:
    """One game’s public artifact feed (anonymous, read replica)

     The hot path, and it carries no `security`: it serves published artifacts to signed-out visitors and
    runs on the read replica so it does not contend with authenticated traffic. Three predicates are the
    entire boundary — `visibility = 'public'`, `deleted_at is null`, and `ecosystem_id`. The ecosystem
    is taken from the resolved game row, never from the query string. A retired game is 404.

    Args:
        game_id (Union[Unset, str]):
        slug (Union[Unset, str]):
        page (Union[Unset, str]):
        page_size (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, GetGameFeedResponse200]
    """

    return sync_detailed(
        client=client,
        game_id=game_id,
        slug=slug,
        page=page,
        page_size=page_size,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    game_id: Unset | str = UNSET,
    slug: Unset | str = UNSET,
    page: Unset | str = UNSET,
    page_size: Unset | str = UNSET,
) -> Response[Error | GetGameFeedResponse200]:
    """One game’s public artifact feed (anonymous, read replica)

     The hot path, and it carries no `security`: it serves published artifacts to signed-out visitors and
    runs on the read replica so it does not contend with authenticated traffic. Three predicates are the
    entire boundary — `visibility = 'public'`, `deleted_at is null`, and `ecosystem_id`. The ecosystem
    is taken from the resolved game row, never from the query string. A retired game is 404.

    Args:
        game_id (Union[Unset, str]):
        slug (Union[Unset, str]):
        page (Union[Unset, str]):
        page_size (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, GetGameFeedResponse200]]
    """

    kwargs = _get_kwargs(
        game_id=game_id,
        slug=slug,
        page=page,
        page_size=page_size,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    game_id: Unset | str = UNSET,
    slug: Unset | str = UNSET,
    page: Unset | str = UNSET,
    page_size: Unset | str = UNSET,
) -> Error | GetGameFeedResponse200 | None:
    """One game’s public artifact feed (anonymous, read replica)

     The hot path, and it carries no `security`: it serves published artifacts to signed-out visitors and
    runs on the read replica so it does not contend with authenticated traffic. Three predicates are the
    entire boundary — `visibility = 'public'`, `deleted_at is null`, and `ecosystem_id`. The ecosystem
    is taken from the resolved game row, never from the query string. A retired game is 404.

    Args:
        game_id (Union[Unset, str]):
        slug (Union[Unset, str]):
        page (Union[Unset, str]):
        page_size (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, GetGameFeedResponse200]
    """

    return (
        await asyncio_detailed(
            client=client,
            game_id=game_id,
            slug=slug,
            page=page,
            page_size=page_size,
        )
    ).parsed
