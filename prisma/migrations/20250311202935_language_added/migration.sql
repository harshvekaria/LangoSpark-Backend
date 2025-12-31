/*
  Warnings:

  - You are about to drop the column `content` on the `Lesson` table. All the data in the column will be lost.
  - You are about to drop the column `language` on the `Lesson` table. All the data in the column will be lost.
  - Added the required column `languageId` to the `Lesson` table without a default value. This is not possible if the table is not empty.
  - Added the required column `level` to the `Lesson` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Lesson` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "content",
DROP COLUMN "language",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "languageId" TEXT NOT NULL,
ADD COLUMN     "level" "Level" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nativeLanguage" TEXT;

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLanguage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "level" "Level" NOT NULL DEFAULT 'BEGINNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Language_name_key" ON "Language"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserLanguage_userId_languageId_key" ON "UserLanguage"("userId", "languageId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProgress_userId_lessonId_key" ON "LearningProgress"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLanguage" ADD CONSTRAINT "UserLanguage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLanguage" ADD CONSTRAINT "UserLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
