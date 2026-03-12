-- Sequential User ID Renumbering Migration
-- This transaction renumbers all User.id values from 1 to N sequentially
-- Updates all 9 foreign key references atomically

BEGIN;

-- Step 1: Create temporary mapping table
CREATE TEMP TABLE id_mapping AS
SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as new_id
FROM "User";

-- Step 2: Drop all foreign key constraints
ALTER TABLE "ParentChild" DROP CONSTRAINT "ParentChild_parentId_fkey";
ALTER TABLE "ParentChild" DROP CONSTRAINT "ParentChild_childId_fkey";
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_createdById_fkey";
ALTER TABLE "BlogPost" DROP CONSTRAINT "BlogPost_createdById_fkey";
ALTER TABLE "Poll" DROP CONSTRAINT "Poll_createdById_fkey";
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_userId_fkey";
ALTER TABLE "Training" DROP CONSTRAINT "Training_createdById_fkey";
ALTER TABLE "TrainingAttendance" DROP CONSTRAINT "TrainingAttendance_updatedById_fkey";
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorUserId_fkey";

-- Step 3: Update child tables to use temporary numeric IDs
UPDATE "ParentChild" pc SET "parentId" = im.new_id FROM id_mapping im WHERE pc."parentId" = im.id;
UPDATE "ParentChild" pc SET "childId" = im.new_id FROM id_mapping im WHERE pc."childId" = im.id;
UPDATE "Announcement" a SET "createdById" = im.new_id FROM id_mapping im WHERE a."createdById" = im.id;
UPDATE "BlogPost" bp SET "createdById" = im.new_id FROM id_mapping im WHERE bp."createdById" = im.id;
UPDATE "Poll" p SET "createdById" = im.new_id FROM id_mapping im WHERE p."createdById" = im.id;
UPDATE "PollVote" pv SET "userId" = im.new_id FROM id_mapping im WHERE pv."userId" = im.id;
UPDATE "Training" t SET "createdById" = im.new_id FROM id_mapping im WHERE t."createdById" = im.id;
UPDATE "TrainingAttendance" ta SET "updatedById" = im.new_id FROM id_mapping im WHERE ta."updatedById" = im.id;
UPDATE "AuditLog" al SET "actorUserId" = im.new_id FROM id_mapping im WHERE al."actorUserId" = im.id;

-- Step 4: Update User table with new sequential IDs
UPDATE "User" u SET id = CAST(im.new_id AS TEXT)
FROM id_mapping im WHERE u.id = im.id;

-- Step 5: Recreate all foreign key constraints
ALTER TABLE "ParentChild" ADD CONSTRAINT "ParentChild_parentId_fkey" 
  FOREIGN KEY ("parentId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "ParentChild" ADD CONSTRAINT "ParentChild_childId_fkey" 
  FOREIGN KEY ("childId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" 
  FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_createdById_fkey" 
  FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_createdById_fkey" 
  FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Training" ADD CONSTRAINT "Training_createdById_fkey" 
  FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_updatedById_fkey" 
  FOREIGN KEY ("updatedById") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" 
  FOREIGN KEY ("actorUserId") REFERENCES "User"(id) ON DELETE CASCADE;

COMMIT;
