import { neon } from '@neondatabase/serverless'
import { timingSafeEqual } from 'node:crypto'
import type { DocumentSlice } from '@/lib/persistence'

export interface CloudLayoutRow {
  id: string
  name: string
  saved_at: string
  table_count: number
  vendor_count: number
  data?: DocumentSlice
}

function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL
  if (!value) {
    throw new Error('DATABASE_URL is not configured.')
  }
  return value
}

function getSaveKey(): string {
  const value = process.env.FLOORPLANNER_SAVE_KEY
  if (!value) {
    throw new Error('FLOORPLANNER_SAVE_KEY is not configured.')
  }
  return value
}

function getSql() {
  return neon(getDatabaseUrl())
}

export function isCloudSaveConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.FLOORPLANNER_SAVE_KEY)
}

export function authorizeCloudRequest(providedKey: string | null): boolean {
  if (!providedKey) return false

  const expected = Buffer.from(getSaveKey())
  const received = Buffer.from(providedKey)
  if (expected.length !== received.length) return false

  return timingSafeEqual(expected, received)
}

export async function ensureCloudLayoutsTable(): Promise<void> {
  const sql = getSql()
  await sql`
    create table if not exists floorplanner_cloud_layouts (
      id text primary key,
      name text not null,
      data jsonb not null,
      table_count integer not null default 0,
      vendor_count integer not null default 0,
      created_at timestamptz not null default now(),
      saved_at timestamptz not null default now()
    )
  `
}

export async function listCloudLayouts(): Promise<CloudLayoutRow[]> {
  const sql = getSql()
  const rows = await sql`
    select id, name, saved_at, table_count, vendor_count
    from floorplanner_cloud_layouts
    order by saved_at desc, name asc
  `
  return rows as CloudLayoutRow[]
}

export async function getCloudLayout(id: string): Promise<CloudLayoutRow | null> {
  const sql = getSql()
  const rows = await sql`
    select id, name, saved_at, table_count, vendor_count, data
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
}): Promise<CloudLayoutRow> {
  const sql = getSql()
  const tableCount = Object.keys(input.data.tables).length
  const vendorCount = Object.keys(input.data.vendors).length

  const rows = await sql`
    insert into floorplanner_cloud_layouts (id, name, data, table_count, vendor_count, saved_at)
    values (${input.id}, ${input.name}, ${JSON.stringify(input.data)}, ${tableCount}, ${vendorCount}, now())
    on conflict (id) do update
      set name = excluded.name,
          data = excluded.data,
          table_count = excluded.table_count,
          vendor_count = excluded.vendor_count,
          saved_at = now()
    returning id, name, saved_at, table_count, vendor_count
  `

  return (rows as CloudLayoutRow[])[0]
}

export async function deleteCloudLayout(id: string): Promise<void> {
  const sql = getSql()
  await sql`
    delete from floorplanner_cloud_layouts
    where id = ${id}
  `
}
