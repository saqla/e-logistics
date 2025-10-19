import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const token = req.headers.get('x-import-token') || ''
    if (!process.env.SHIFT_IMPORT_TOKEN || token !== process.env.SHIFT_IMPORT_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existsRows = await prisma.$queryRawUnsafe<any[]>(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_assignments' LIMIT 1"
    )
    const already = Array.isArray(existsRows) && existsRows.length > 0

    if (!already) {
      await prisma.$transaction([
        prisma.$executeRawUnsafe(`DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShiftRouteKind') THEN
            CREATE TYPE "ShiftRouteKind" AS ENUM ('SANCHOKU','DONKI_FUKUOKA','DONKI_NAGASAKI','UNIC','OFF','PAID_LEAVE');
          END IF;
        END $$;`),
        prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "shift_assignments" (
          "id" TEXT PRIMARY KEY,
          "year" INTEGER NOT NULL,
          "month" INTEGER NOT NULL,
          "day" INTEGER NOT NULL,
          "staffId" TEXT NOT NULL,
          "route" "ShiftRouteKind" NOT NULL,
          "carNumber" TEXT,
          "noteBL" TEXT,
          "noteBR" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );`),
        prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "shift_assignments_year_month_day_staffId_key"
          ON "shift_assignments" ("year","month","day","staffId");`),
        prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "shift_assignments_year_month_day_idx"
          ON "shift_assignments" ("year","month","day");`),
        prisma.$executeRawUnsafe(`DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'shift_assignments_staffId_fkey'
          ) THEN
            ALTER TABLE "shift_assignments"
            ADD CONSTRAINT "shift_assignments_staffId_fkey"
            FOREIGN KEY ("staffId") REFERENCES "staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END $$;`),
        prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
          BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;`),
        prisma.$executeRawUnsafe(`DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_shift_assignments_set_updated_at') THEN
            CREATE TRIGGER trg_shift_assignments_set_updated_at
            BEFORE UPDATE ON "shift_assignments"
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
          END IF;
        END $$;`),
      ])
    }

    return NextResponse.json({ ok: true, created: !already })
  } catch (e: any) {
    console.error('POST /api/admin/migrate error:', e)
    return NextResponse.json({ error: e?.message || 'Internal Error' }, { status: 500 })
  }
}


