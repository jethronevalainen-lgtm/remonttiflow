create table if not exists private.auth_activation_settings (
  id boolean primary key default true check (id),
  app_origin text not null,
  callback_path text not null default '/auth/callback',
  updated_at timestamptz not null default now(),
  constraint auth_activation_settings_https check (app_origin ~ '^https://')
);

insert into private.auth_activation_settings(id, app_origin, callback_path)
values (true, 'https://vakantti.pages.dev', '/auth/callback')
on conflict (id) do update set
  app_origin = excluded.app_origin,
  callback_path = excluded.callback_path,
  updated_at = now();

revoke all on private.auth_activation_settings from public, anon, authenticated;
