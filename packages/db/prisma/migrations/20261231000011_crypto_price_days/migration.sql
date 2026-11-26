-- CreateTable
CREATE TABLE "crypto_price_days" (
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "usdPrice" TEXT NOT NULL,

    CONSTRAINT "crypto_price_days_pkey" PRIMARY KEY ("chainId","tokenAddress","day")
);
