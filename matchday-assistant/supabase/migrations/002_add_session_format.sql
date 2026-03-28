-- Add game format to sessions table
alter table sessions
  add column format smallint not null default 5
    check (format in (4, 5, 7, 9, 11));
