-- CreateTable
CREATE TABLE "StageTransition" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageTransition_stageId_createdAt_idx" ON "StageTransition"("stageId", "createdAt");

-- CreateIndex
CREATE INDEX "StageTransition_opportunityId_idx" ON "StageTransition"("opportunityId");

-- AddForeignKey
ALTER TABLE "StageTransition" ADD CONSTRAINT "StageTransition_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageTransition" ADD CONSTRAINT "StageTransition_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Перенос существующих данных: для каждой сделки записывается её текущая стадия
-- на дату закрытия или последнего изменения (точная история до этого момента не хранилась).
INSERT INTO "StageTransition" ("id", "opportunityId", "stageId", "amount", "createdAt")
SELECT 'bf_' || "id", "id", "stageId", "amount", COALESCE("closedAt", "updatedAt")
FROM "Opportunity";
