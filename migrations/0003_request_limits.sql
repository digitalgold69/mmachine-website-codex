create table if not exists request_limits (
  scope text not null,
  key_hash text not null,
  window_start integer not null,
  hits integer not null default 0,
  primary key (scope, key_hash, window_start)
);

create index if not exists request_limits_window_idx
on request_limits (window_start);
