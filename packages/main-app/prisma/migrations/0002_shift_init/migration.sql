-- CreateEnum
CREATE TYPE "ShiftRouteKind" AS ENUM ('SANCHOKU','DONKI_FUKUOKA','DONKI_NAGASAKI','UNIC','OFF','PAID_LEAVE');

-- CreateTable
CREATE TABLE "shift_assignments" (
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
);

-- Indexes & Constraints
CREATE UNIQUE INDEX "shift_assignments_year_month_day_staffId_key"
  ON "shift_assignments" ("year","month","day","staffId");

CREATE INDEX "shift_assignments_year_month_day_idx"
  ON "shift_assignments" ("year","month","day");

-- Foreign Key
ALTER TABLE "shift_assignments"
  ADD CONSTRAINT "shift_assignments_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trigger to update updatedAt
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shift_assignments_set_updated_at ON "shift_assignments";
CREATE TRIGGER trg_shift_assignments_set_updated_at
BEFORE UPDATE ON "shift_assignments"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


