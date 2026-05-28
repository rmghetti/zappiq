-- CreateEnum
CREATE TYPE "FlowTemplateVertical" AS ENUM ('DENTISTA', 'SALAO_BELEZA', 'ACADEMIA', 'PETSHOP', 'ECOMMERCE_MODA');

-- CreateEnum
CREATE TYPE "FlowTemplateCategory" AS ENUM ('BOAS_VINDAS_QUALIFICACAO', 'AGENDAMENTO_RECUPERACAO', 'NPS_POS_VENDA');

-- CreateTable
CREATE TABLE "flow_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vertical" "FlowTemplateVertical" NOT NULL,
    "category" "FlowTemplateCategory" NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "triggerType" "FlowTriggerType" NOT NULL,
    "triggerConfig" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "flow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flow_templates_vertical_idx" ON "flow_templates"("vertical");
CREATE INDEX "flow_templates_category_idx" ON "flow_templates"("category");
