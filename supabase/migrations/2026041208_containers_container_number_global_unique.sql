do $$
begin
  if exists (
    select 1
    from (
      select c.container_number
      from public.containers c
      where c.container_number is not null
      group by c.container_number
      having count(*) > 1
    ) duplicates
  ) then
    raise exception
      'Cannot enforce unique public.containers(container_number): duplicate container_number values already exist.';
  end if;
end
$$;

create unique index if not exists containers_container_number_key
  on public.containers using btree (container_number);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'containers_container_number_key'
      and conrelid = 'public.containers'::regclass
  ) then
    alter table public.containers
      add constraint containers_container_number_key
      unique using index containers_container_number_key;
  end if;
end
$$;