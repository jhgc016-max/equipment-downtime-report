-- Apply to the existing project before deploying the public-sync client.
-- Old account workspaces remain private; their data is not copied here.
create table if not exists public.downtime_shared_workspace (
 id text primary key check (id = 'public'),
 revision bigint not null check (revision > 0),
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4194304),
 updated_at timestamptz not null default now()
);
alter table public.downtime_shared_workspace enable row level security;
revoke all on public.downtime_shared_workspace from anon, authenticated;
grant select on public.downtime_shared_workspace to anon, authenticated;
drop policy if exists public_workspace_read on public.downtime_shared_workspace;
create policy public_workspace_read on public.downtime_shared_workspace
 for select to anon, authenticated using (id = 'public');

-- The singleton row and advisory lock serialize writes, including first use.
create or replace function public.save_shared_downtime_workspace(expected_revision bigint, workspace jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.downtime_shared_workspace%rowtype;
begin
 if expected_revision is null or expected_revision < 0 or workspace is null
 or jsonb_typeof(workspace) <> 'object' or octet_length(workspace::text) > 4194304
 or workspace->>'version' is distinct from '1'
 or jsonb_typeof(workspace->'files') is distinct from 'array'
 or jsonb_typeof(workspace->'settings') is distinct from 'object'
 or exists (select 1 from jsonb_object_keys(workspace) as keys(k) where k not in ('version','files','settings'))
 then raise exception 'Invalid workspace'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('downtime-public-workspace', 0));
 select * into current_row from public.downtime_shared_workspace where id = 'public';
 if (current_row.id is null and expected_revision <> 0)
 or (current_row.id is not null and current_row.revision <> expected_revision) then
  return jsonb_build_object('ok',false,'revision',coalesce(current_row.revision,0),'payload',current_row.payload,'updated_at',current_row.updated_at);
 end if;
 insert into public.downtime_shared_workspace(id,revision,payload,updated_at)
 values('public',1,workspace,now())
 on conflict(id) do update set revision = public.downtime_shared_workspace.revision+1, payload = excluded.payload, updated_at = now()
 returning * into current_row;
 return jsonb_build_object('ok',true,'revision',current_row.revision,'payload',current_row.payload,'updated_at',current_row.updated_at);
end;
$$;
revoke all on function public.save_shared_downtime_workspace(bigint,jsonb) from public;
grant execute on function public.save_shared_downtime_workspace(bigint,jsonb) to anon, authenticated;
