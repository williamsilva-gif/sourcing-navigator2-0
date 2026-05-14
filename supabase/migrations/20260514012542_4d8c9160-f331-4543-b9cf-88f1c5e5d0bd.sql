
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in_tenant(uuid, app_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ta_master(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.visible_tenant_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hotel_member(uuid, uuid) TO authenticated;
