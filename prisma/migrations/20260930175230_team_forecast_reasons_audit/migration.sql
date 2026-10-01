-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "assigneeId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "managerId" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "lostReasonId" TEXT,
ADD COLUMN     "managerId" TEXT;

-- AlterTable
ALTER TABLE "Stage" ADD COLUMN     "probability" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Manager" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostReason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "requiresComment" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LostReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LostReason_name_key" ON "LostReason"("name");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Activity_assigneeId_idx" ON "Activity"("assigneeId");

-- CreateIndex
CREATE INDEX "Lead_managerId_idx" ON "Lead"("managerId");

-- CreateIndex
CREATE INDEX "Opportunity_managerId_idx" ON "Opportunity"("managerId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_lostReasonId_fkey" FOREIGN KEY ("lostReasonId") REFERENCES "LostReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Вероятности закрытия по стадиям (для прогноза выручки).
UPDATE "Stage" SET "probability" = CASE "code"
  WHEN 'new' THEN 10
  WHEN 'qualification' THEN 25
  WHEN 'proposal' THEN 50
  WHEN 'negotiation' THEN 75
  WHEN 'won' THEN 100
  ELSE 0
END;

-- Справочник причин отказа.
INSERT INTO "LostReason" ("id", "name", "position", "requiresComment") VALUES
  ('lr_price', 'Цена выше ожиданий', 1, false),
  ('lr_competitor', 'Выбрали другого подрядчика', 2, false),
  ('lr_timing', 'Не подошли сроки', 3, false),
  ('lr_budget', 'Бюджет сократили или отменили', 4, false),
  ('lr_silent', 'Клиент перестал отвечать', 5, false),
  ('lr_other', 'Другое', 6, true);

-- Перенос существующих отказов: прежний свободный текст становится комментарием к причине «Другое».
UPDATE "Opportunity" SET "lostReasonId" = 'lr_other' WHERE "status" = 'lost' AND "lostReasonId" IS NULL;

-- Целостность: у активности ровно одна цель (сделка, лид, контакт или компания).
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_exactly_one_target_chk"
  CHECK (num_nonnulls("opportunityId", "leadId", "contactId", "accountId") = 1);
