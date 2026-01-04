/*
  Warnings:

  - You are about to drop the column `session_state` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the `verification_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "session_state";

-- DropTable
DROP TABLE "verification_tokens";
