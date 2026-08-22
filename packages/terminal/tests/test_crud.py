from __future__ import annotations

import httpx
import pytest
import respx
from typer.testing import CliRunner

from apt_terminal import config as c
from apt_terminal import crud
from apt_terminal import resources as r
from apt_terminal.auth import Session
from apt_terminal.errors import AptError

BASE = "https://api.test"
runner = CliRunner()


def _session(tmp_path) -> Session:
    cfg = c.Config(path=tmp_path / "config.toml")
    p = cfg.profile()
    p.base_url = BASE
    p.access_token = "acc"
    return Session(profile=p, config=cfg)


def test_parse_set_coerces_json():
    assert crud.parse_set(["name=foo", "n=5", "flag=true"]) == {
        "name": "foo", "n": 5, "flag": True,
    }


def test_build_body_rejects_unknown_field():
    from apt_terminal.generated.models.post_persona_services_body import (
        PostPersonaServicesBody,
    )
    with pytest.raises(AptError):
        crud.build_body(PostPersonaServicesBody, ["bogus=1"])


def test_build_body_builds_model():
    from apt_terminal.generated.models.post_persona_services_body import (
        PostPersonaServicesBody,
    )
    body = crud.build_body(
        PostPersonaServicesBody,
        ["name=svc", "provider_kind=openai", "base_url=https://o.test"],
    )
    assert body.name == "svc"
    assert body.to_dict()["providerKind"] == "openai"


@respx.mock
def test_list_renders_json(tmp_path):
    services = next(res for res in r.PERSONA if res.name == "services")
    app = crud.build_resource_app(services, lambda: _session(tmp_path))
    respx.get(f"{BASE}/persona/services").mock(
        return_value=httpx.Response(200, json=[
            {"id": "1", "name": "svc", "providerKind": "openai",
             "baseUrl": "https://o.test", "status": "ok"},
        ])
    )
    res = runner.invoke(app, ["list", "--json"])
    assert res.exit_code == 0, res.output
    assert '"id": "1"' in res.output


@respx.mock
def test_create_posts_body(tmp_path):
    services = next(res for res in r.PERSONA if res.name == "services")
    app = crud.build_resource_app(services, lambda: _session(tmp_path))
    route = respx.post(f"{BASE}/persona/services").mock(
        return_value=httpx.Response(201, json={"id": "9", "name": "svc",
            "providerKind": "openai", "baseUrl": "https://o.test", "status": "new"})
    )
    res = runner.invoke(app, [
        "create", "--set", "name=svc", "--set", "provider_kind=openai",
        "--set", "base_url=https://o.test", "--json",
    ])
    assert res.exit_code == 0, res.output
    assert route.called
    import json as _json
    sent = route.calls.last.request
    assert _json.loads(sent.content)["providerKind"] == "openai"


@respx.mock
def test_401_triggers_refresh_then_retry(tmp_path):
    sess = _session(tmp_path)
    sess.profile.refresh_token = "ref"
    services = next(res for res in r.PERSONA if res.name == "services")
    app = crud.build_resource_app(services, lambda: sess)
    respx.get(f"{BASE}/persona/services").mock(side_effect=[
        httpx.Response(401, json={"error": {"message": "expired"}}),
        httpx.Response(200, json=[]),
    ])
    respx.post(f"{BASE}/auth/refresh").mock(
        return_value=httpx.Response(200, json={"accessToken": "acc2"},
            headers={"set-cookie": "refresh_token=ref2; HttpOnly"})
    )
    res = runner.invoke(app, ["list", "--json"])
    assert res.exit_code == 0, res.output
    assert sess.profile.access_token == "acc2"


@respx.mock
def test_models_action_renders_string_list(tmp_path):
    services = next(res for res in r.PERSONA if res.name == "services")
    app = crud.build_resource_app(services, lambda: _session(tmp_path))
    respx.get(f"{BASE}/persona/services/svc1/models").mock(
        return_value=httpx.Response(200, json=["gpt-4o", "gpt-4o-mini"])
    )
    res = runner.invoke(app, ["models", "svc1"])
    assert res.exit_code == 0, res.output
    assert "gpt-4o" in res.output


@respx.mock
def test_error_status_exits_nonzero(tmp_path):
    services = next(res for res in r.PERSONA if res.name == "services")
    app = crud.build_resource_app(services, lambda: _session(tmp_path))
    respx.get(f"{BASE}/persona/services").mock(
        return_value=httpx.Response(400, json={"error": {"message": "bad"}})
    )
    res = runner.invoke(app, ["list"])
    assert res.exit_code != 0


@respx.mock
def test_404_raises_not_found_exit_code(tmp_path):
    """A 404 response raises NotFoundError (exit_code=4), confirmed via raised exception."""
    from apt_terminal.errors import NotFoundError as NFE
    services = next(res for res in r.PERSONA if res.name == "services")
    sess = _session(tmp_path)
    respx.get(f"{BASE}/persona/services").mock(
        return_value=httpx.Response(404, json={"title": "not found"})
    )
    with pytest.raises(NFE) as exc_info:
        crud.execute(services.ops.list_, session=sess)
    assert exc_info.value.exit_code == 4


@respx.mock
def test_401_no_refresh_raises_auth_error(tmp_path):
    """A 401 with no refresh token raises AuthError (exit_code=3)."""
    from apt_terminal.errors import AuthError as AE
    services = next(res for res in r.PERSONA if res.name == "services")
    sess = _session(tmp_path)
    # no refresh_token set, so refresh() returns False
    respx.get(f"{BASE}/persona/services").mock(
        return_value=httpx.Response(401, json={"title": "unauthorized"})
    )
    with pytest.raises(AE) as exc_info:
        crud.execute(services.ops.list_, session=sess)
    assert exc_info.value.exit_code == 3


@respx.mock
def test_empty_list_renders_none(tmp_path):
    services = next(res for res in r.PERSONA if res.name == "services")
    app = crud.build_resource_app(services, lambda: _session(tmp_path))
    respx.get(f"{BASE}/persona/services").mock(
        return_value=httpx.Response(200, json=[])
    )
    res = runner.invoke(app, ["list"])
    assert res.exit_code == 0, res.output
    assert "(none)" in res.output


# --- enum coercion -------------------------------------------------------------------
#
# The generated body models are plain attrs classes with no converters, so before
# `coerce_enums` a `--set provider_kind=openai` stored the STRING and the command died later
# inside generated `to_dict()` with `AttributeError: 'str' object has no attribute 'value'`.
# These pin the coercion and, just as importantly, the error the user gets when the value is
# not a member — the old path could only crash.


def _services_body():
    from apt_terminal.generated.models.post_persona_services_body import (
        PostPersonaServicesBody,
    )

    return PostPersonaServicesBody


def test_build_body_coerces_a_string_into_the_declared_enum():
    body = crud.build_body(_services_body(), [
        "name=svc", "provider_kind=openai", "base_url=https://o.test",
    ])
    from apt_terminal.generated.models.post_persona_services_body_provider_kind import (
        PostPersonaServicesBodyProviderKind,
    )

    assert body.provider_kind is PostPersonaServicesBodyProviderKind.OPENAI


def test_a_coerced_body_serializes_instead_of_raising():
    # The regression itself: the failure was never at construction, it was here.
    body = crud.build_body(_services_body(), [
        "name=svc", "provider_kind=openai", "base_url=https://o.test",
    ])
    assert body.to_dict()["providerKind"] == "openai"


def test_build_body_names_the_field_and_the_choices_for_a_bad_enum_value():
    with pytest.raises(AptError) as exc:
        crud.build_body(_services_body(), [
            "name=svc", "provider_kind=nope", "base_url=https://o.test",
        ])
    msg = str(exc.value)
    assert "provider_kind" in msg
    assert "openai" in msg


def test_build_body_leaves_a_non_enum_field_alone():
    body = crud.build_body(_services_body(), [
        "name=svc", "provider_kind=openai", "base_url=https://o.test",
    ])
    assert body.name == "svc"


def test_enum_type_looks_through_a_union_but_not_an_ambiguous_one():
    import enum

    class A(enum.Enum):
        X = "x"

    class B(enum.Enum):
        Y = "y"

    assert crud.enum_type(A) is A
    # An optional enum is still an enum as far as a --set value is concerned.
    assert crud.enum_type(A | None) is A
    assert crud.enum_type(str) is None
    # Two enums in one union would make the coercion a guess, so it declines.
    assert crud.enum_type(A | B) is None
