-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."StaffKind" AS ENUM ('ALL', 'UNIC', 'HAKO', 'JIMU');

-- CreateEnum
CREATE TYPE "public"."RouteKind" AS ENUM ('EZAKI_DONKI', 'SANCHOKU', 'MARUNO_DONKI');

-- CreateEnum
CREATE TYPE "public"."RouteSpecialValue" AS ENUM ('CONTINUE', 'OFF');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."staffs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."StaffKind" NOT NULL,
    "userId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."day_notes" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "day_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."route_assignments" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "route" "public"."RouteKind" NOT NULL,
    "staffId" TEXT,
    "special" "public"."RouteSpecialValue",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lower_assignments" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lower_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."remarks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staffs_userId_key" ON "public"."staffs"("userId");

-- CreateIndex
CREATE INDEX "staffs_name_idx" ON "public"."staffs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "day_notes_year_month_day_slot_key" ON "public"."day_notes"("year", "month", "day", "slot");

-- CreateIndex
CREATE INDEX "route_assignments_year_month_day_idx" ON "public"."route_assignments"("year", "month", "day");

-- CreateIndex
CREATE UNIQUE INDEX "route_assignments_year_month_day_route_key" ON "public"."route_assignments"("year", "month", "day", "route");

-- CreateIndex
CREATE INDEX "lower_assignments_year_month_day_idx" ON "public"."lower_assignments"("year", "month", "day");

-- CreateIndex
CREATE UNIQUE INDEX "lower_assignments_year_month_day_staffId_key" ON "public"."lower_assignments"("year", "month", "day", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "lower_assignments_year_month_day_rowIndex_key" ON "public"."lower_assignments"("year", "month", "day", "rowIndex");

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staffs" ADD CONSTRAINT "staffs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."route_assignments" ADD CONSTRAINT "route_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lower_assignments" ADD CONSTRAINT "lower_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

