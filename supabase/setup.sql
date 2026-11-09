-- Run once in a NEW Supabase project's SQL Editor.
create table if not exists public.downtime_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null check (revision > 0),
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4194304),
 updated_at timestamptz not null default now()
);
alter table public.downtime_workspaces enable row level security;
revoke all on public.downtime_workspaces from anon, authenticated;
grant select on public.downtime_workspaces to authenticated;
drop policy if exists own_workspace_read on public.downtime_workspaces;
create policy own_workspace_read on public.downtime_workspaces for select to authenticated using ((select auth.uid()) = user_id);

-- A client cannot bypass revision checks through direct INSERT/UPDATE.
-- Serialize each account, including the initial insert, inside one transaction.
create or replace function public.save_downtime_workspace(expected_revision bigint, workspace jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); current_row public.downtime_workspaces%rowtype;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if expected_revision is null or expected_revision < 0 or workspace is null
 or jsonb_typeof(workspace) <> 'object' or octet_length(workspace::text) > 4194304
 or workspace->>'version' is distinct from '1'
 or jsonb_typeof(workspace->'files') is distinct from 'array'
 or jsonb_typeof(workspace->'settings') is distinct from 'object'
 or exists (select 1 from jsonb_object_keys(workspace) as keys(k) where k not in ('version','files','settings'))
 then raise exception 'Invalid workspace'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
 select * into current_row from public.downtime_workspaces where user_id = owner_id;
 if (current_row.user_id is null and expected_revision <> 0)
 or (current_row.user_id is not null and current_row.revision <> expected_revision) then
  return jsonb_build_object('ok',false,'revision',coalesce(current_row.revision,0),'payload',current_row.payload,'updated_at',current_row.updated_at);
 end if;
 insert into public.downtime_workspaces(user_id,revision,payload,updated_at)
 values(owner_id,1,workspace,now())
 on conflict(user_id) do update set revision = public.downtime_workspaces.revision+1, payload = excluded.payload, updated_at = now()
 returning * into current_row;
 return jsonb_build_object('ok',true,'revision',current_row.revision,'payload',current_row.payload,'updated_at',current_row.updated_at);
end;
$$;
revoke all on function public.save_downtime_workspace(bigint,jsonb) from public, anon;
grant execute on function public.save_downtime_workspace(bigint,jsonb) to authenticated;
