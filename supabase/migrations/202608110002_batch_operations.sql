create or replace function public.batch_add_monthly_mappings(
  target_workspace uuid,
  target_month date,
  existing_executive_ids uuid[] default '{}',
  new_agents jsonb default '[]'::jsonb
) returns setof public.monthly_mappings
language plpgsql security invoker set search_path = public
as $$
declare agent jsonb; executive_record public.executives; selected_ids uuid[] := coalesce(existing_executive_ids, '{}');
begin
  if not public.is_workspace_member(target_workspace) then raise exception 'Workspace access denied'; end if;
  if extract(day from target_month) <> 1 then raise exception 'Month must be the first day of a month'; end if;
  if coalesce(array_length(existing_executive_ids, 1), 0) = 0 and jsonb_array_length(new_agents) = 0 then raise exception 'At least one agent is required'; end if;

  for agent in select * from jsonb_array_elements(new_agents) loop
    insert into public.executives(workspace_id, employee_id, executive_name, email, doj, manager, source, status)
    values(target_workspace, agent->>'employeeId', agent->>'name', lower(agent->>'email'), (agent->>'doj')::date, agent->>'manager', agent->>'source', upper(coalesce(agent->>'status', 'ACTIVE')))
    on conflict (workspace_id, employee_id) do update set
      executive_name = excluded.executive_name, email = excluded.email, doj = excluded.doj,
      manager = excluded.manager, source = excluded.source, status = excluded.status, updated_at = now()
    returning * into executive_record;
    selected_ids := array_append(selected_ids, executive_record.id);
  end loop;

  insert into public.monthly_mappings(workspace_id, month, executive_id, employee_id, executive_name, email, manager, source, tenurity, status)
  select target_workspace, target_month, executive.id, executive.employee_id, executive.executive_name, executive.email,
    executive.manager, executive.source,
    case
      when ((extract(year from target_month) - extract(year from executive.doj)) * 12 + extract(month from target_month) - extract(month from executive.doj)) = 0 then 'M0'
      when ((extract(year from target_month) - extract(year from executive.doj)) * 12 + extract(month from target_month) - extract(month from executive.doj)) = 1 then 'M1'
      else 'M1+'
    end,
    executive.status
  from public.executives executive
  where executive.workspace_id = target_workspace and executive.id = any(selected_ids) and executive.doj <= (target_month + interval '1 month - 1 day')::date
  on conflict (workspace_id, month, executive_id) do update set
    employee_id = excluded.employee_id, executive_name = excluded.executive_name, email = excluded.email,
    manager = excluded.manager, source = excluded.source, tenurity = excluded.tenurity, status = excluded.status;

  return query select mapping.* from public.monthly_mappings mapping
    where mapping.workspace_id = target_workspace and mapping.month = target_month and mapping.executive_id = any(selected_ids)
    order by mapping.executive_name;
end;
$$;

create or replace function public.batch_create_target_versions(target_workspace uuid, targets jsonb)
returns setof public.target_versions
language plpgsql security invoker set search_path = public
as $$
declare target jsonb; created_target public.target_versions;
begin
  if not public.is_workspace_member(target_workspace) then raise exception 'Workspace access denied'; end if;
  if jsonb_array_length(targets) = 0 then raise exception 'At least one target is required'; end if;
  for target in select * from jsonb_array_elements(targets) loop
    select * into created_target from public.create_target_version(
      target_workspace, target->>'source', target->>'tenurity', (target->>'effectiveFrom')::date,
      (target->>'revenue')::numeric, (target->>'login')::numeric, (target->>'demo')::numeric,
      (target->>'license')::numeric, (target->>'proPlatform')::numeric, (target->>'arpl')::numeric
    );
    return next created_target;
  end loop;
end;
$$;

grant execute on function public.batch_add_monthly_mappings(uuid,date,uuid[],jsonb) to authenticated;
grant execute on function public.batch_create_target_versions(uuid,jsonb) to authenticated;
