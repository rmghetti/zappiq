-- Cupons de desconto emitidos pelo SUPERADMIN (escopados a produto, uso único).
-- Aditiva e idempotente.
CREATE TABLE IF NOT EXISTS "discount_coupons" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "stripe_coupon_id" TEXT NOT NULL,
  "stripe_promotion_code_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "product_key" TEXT NOT NULL,
  "product_label" TEXT NOT NULL,
  "percent_off" INTEGER NOT NULL,
  "duration" TEXT NOT NULL,
  "duration_in_months" INTEGER,
  "created_by_email" TEXT NOT NULL,
  "times_redeemed" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discount_coupons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "discount_coupons_code_key" ON "discount_coupons"("code");
CREATE INDEX IF NOT EXISTS "discount_coupons_product_key_idx" ON "discount_coupons"("product_key");
