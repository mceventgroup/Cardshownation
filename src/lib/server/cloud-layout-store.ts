import { neon } from '@neondatabase/serverless'
import type { DocumentSlice } from '@/lib/persistence'

export interface CloudLayoutRow {
  id: string
  name: string
  saved_at: string
  revision: number
  table_count: number
  vendor_count: number
  data?: DocumentSlice
}

export class CloudLayoutConflictError extends Error {
  currentLayout: CloudLayoutRow | null

  constructor(message: string, currentLayout: CloudLayoutRow | null) {
    super(message)
    this.name = 'CloudLayoutConflictError'
    this.currentLayout = currentLayout
  }
}

function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL
  if (!value) {
    throw new Error('DATABASE_URL is not configured.')
  }
  return value
}

function getSql() {
  return neon(getDatabaseUrl())
}

export function isCloudSaveConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export async function ensureCloudLayoutsTable(): Promise<void> {
  const sql = getSql()
  await sql`
    create table if not exists floorplanner_cloud_layouts (
      id text primary key,
      name text not null,
      data jsonb not null,
      revision integer not null default 1,
      table_count integer not null default 0,
      vendor_count integer not null default 0,
      created_at timestamptz not null default now(),
      saved_at timestamptz not null default now()
    )
  `
  await sql`
    alter table floorplanner_cloud_layouts
    add column if not exists revision integer not null default 1
  `
}

export async function listCloudLayouts(): Promise<CloudLayoutRow[]> {
  const sql = getSql()
  const rows = await sql`
    select id, name, saved_at, revision, table_count, vendor_count
    from floorplanner_cloud_layouts
    order by saved_at desc, name asc
  `
  return rows as CloudLayoutRow[]
}

export async function getCloudLayout(id: string): Promise<CloudLayoutRow | null> {
  const sql = getSql()
  const rows = await sql`
    select id, name, saved_at, revision, table_count, vendor_count, data
    from floorplanner_cloud_layouts
    where id = ${id}
    limit 1
  `
  return (rows as CloudLayoutRow[])[0] ?? null
}

export async function upsertCloudLayout(input: {
  id: string
  name: string
  data: DocumentSlice
  expectedRevision: number | null
}): Promise<CloudLayoutRow> {
  const sql = getSql()
  const tableCount = Object.keys(input.data.tables).length
  const vendorCount = Object.keys(input.data.vendors).length

  if (input.expectedRevision === null) {
    const inserted = await sql`
      insert into floorplanner_cloud_layouts (id, name, data, revision, table_count, vendor_count, saved_at)
      values (${input.id}, ${input.name}, ${JSON.stringify(input.data)}, 1, ${tableCount}, ${vendorCount}, now())
      on conflict (id) do nothing
      returning id, name, saved_at, revision, table_count, vendor_count
    `

    const row = (inserted as CloudLayoutRow[])[0]
    if (row) return row

    const current = await getCloudLayout(input.id)
    throw new CloudLayoutConflictError(
      'This cloud layout already exists. Reload it before saving again.',
      current,
    )
  }

  const rows = await sql`
    update floorplanner_cloud_layouts
    set name = ${input.name},
        data = ${JSON.stringify(input.data)},
        revision = revision + 1,
        table_count = ${tableCount},
        vendor_count = ${vendorCount},
        saved_at = now()
    where id = ${input.id}
      and revision = ${input.expectedRevision}
    returning id, name, saved_at, revision, table_count, vendor_count
  `

  const row = (rows as CloudLayoutRow[])[0]
  if (row) return row

  const current = await getCloudLayout(input.id)
  if (current) {
    throw new CloudLayoutConflictError(
      'This cloud layout changed since you loaded it. Reload it before saving again.',
      current,
    )
  }

  throw new CloudLayoutConflictError(
    'This cloud layout no longer exists on the server. Reload your cloud layouts list.',
    null,
  )
}

export async function deleteCloudLayout(id: string): Promise<void> {
  const sql = getSql()
  await sql`
    delete from floorplanner_cloud_layouts
    where id = ${id}
  `
}
