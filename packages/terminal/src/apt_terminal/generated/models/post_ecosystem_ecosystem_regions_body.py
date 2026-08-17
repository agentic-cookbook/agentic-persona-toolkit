from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define

from ..types import UNSET, Unset

T = TypeVar("T", bound="PostEcosystemEcosystemRegionsBody")


@_attrs_define
class PostEcosystemEcosystemRegionsBody:
    """
    Attributes:
        display_name (str):
        postgres_host (Union[Unset, str]):
        railway_service_id (Union[Unset, str]):
        is_default_for_new_projects (Union[Unset, bool]):
    """

    display_name: str
    postgres_host: Unset | str = UNSET
    railway_service_id: Unset | str = UNSET
    is_default_for_new_projects: Unset | bool = UNSET

    def to_dict(self) -> dict[str, Any]:
        display_name = self.display_name

        postgres_host = self.postgres_host

        railway_service_id = self.railway_service_id

        is_default_for_new_projects = self.is_default_for_new_projects

        field_dict: dict[str, Any] = {}

        field_dict.update(
            {
                "displayName": display_name,
            }
        )
        if postgres_host is not UNSET:
            field_dict["postgresHost"] = postgres_host
        if railway_service_id is not UNSET:
            field_dict["railwayServiceId"] = railway_service_id
        if is_default_for_new_projects is not UNSET:
            field_dict["isDefaultForNewProjects"] = is_default_for_new_projects

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        display_name = d.pop("displayName")

        postgres_host = d.pop("postgresHost", UNSET)

        railway_service_id = d.pop("railwayServiceId", UNSET)

        is_default_for_new_projects = d.pop("isDefaultForNewProjects", UNSET)

        post_ecosystem_ecosystem_regions_body = cls(
            display_name=display_name,
            postgres_host=postgres_host,
            railway_service_id=railway_service_id,
            is_default_for_new_projects=is_default_for_new_projects,
        )

        return post_ecosystem_ecosystem_regions_body
