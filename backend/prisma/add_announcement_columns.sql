-- Add missing columns to Announcement table
-- Run this on the production database if prisma db push is not available

ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
