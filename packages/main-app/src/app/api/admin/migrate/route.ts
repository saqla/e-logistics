import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const token = req.headers.get('x-import-token') || ''
    if (!process.env.SHIFT_IMPORT_TOKEN || token !== process.env.SHIFT_IMPORT_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const colRows = await prisma.$queryRawUnsafe<any[]>(
      "SELECT 1 FROM information_schema.columns WHERE table_name='shift_assignments' AND column_name='vehicleId' LIMIT 1"
    )
    const migrated = Array.isArray(colRows) && colRows.length > 0

    if (!migrated) {
      await prisma.$transaction([
        prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "vehicles" (
          "id" TEXT PRIMARY KEY,
          "number" TEXT UNIQUE NOT NULL,
          "order" INTEGER NOT NULL DEFAULT 0,
          "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );`),
        prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "shift_assignments" CASCADE;`),
        prisma.$executeRawUnsafe(`DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShiftRouteKind') THEN
            CREATE TYPE "ShiftRouteKind" AS ENUM ('SANCHOKU','DONKI_FUKUOKA','DONKI_NAGASAKI','UNIC','OFF','PAID_LEAVE');
          END IF;
        END $$;`),
        prisma.$executeRawUnsafe(`CREATE TABLE "shift_assignments" (
          "id" TEXT PRIMARY KEY,
          "year" INTEGER NOT NULL,
          "month" INTEGER NOT NULL,
          "day" INTEGER NOT NULL,
          "vehicleId" TEXT NOT NULL,
          "route" "ShiftRouteKind",
          "driverStaffId" TEXT,
          "noteBL" TEXT,
          "noteBR" TEXT,
          "scheduleRouteKey" "RouteKind",
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );`),
        prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "shift_assignments_year_month_day_vehicleId_key"
          ON "shift_assignments" ("year","month","day","vehicleId");`),
        prisma.$executeRawUnsafe(`CREATE INDEX "shift_assignments_year_month_day_idx"
          ON "shift_assignments" ("year","month","day");`),
        prisma.$executeRawUnsafe(`ALTER TABLE "shift_assignments"
          ADD CONSTRAINT "shift_assignments_vehicleId_fkey"
          FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;`),
        prisma.$executeRawUnsafe(`ALTER TABLE "shift_assignments"
          ADD CONSTRAINT "shift_assignments_driverStaffId_fkey"
          FOREIGN KEY ("driverStaffId") REFERENCES "staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;`),
        prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
          BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;`),
        prisma.$executeRawUnsafe(`CREATE TRIGGER trg_shift_assignments_set_updated_at
          BEFORE UPDATE ON "shift_assignments"
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();`),
      ])
    }

    return NextResponse.json({ ok: true, migrated: !migrated })
  } catch (e: any) {
    console.error('POST /api/admin/migrate error:', e)
    return NextResponse.json({ error: e?.message || 'Internal Error' }, { status: 500 })
  }
}
