-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryEs" TEXT,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "placeId" TEXT NOT NULL,
    "phoneRaw" TEXT,
    "phoneWhatsapp" TEXT,
    "email" TEXT,
    "emails" TEXT[],
    "emailSource" TEXT,
    "googleRating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "priceLevel" INTEGER,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "businessHours" JSONB,
    "googleMapsUrl" TEXT,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "websiteUrl" TEXT,
    "websiteStatus" TEXT DEFAULT 'none',
    "websiteLoadTime" INTEGER,
    "websiteIssues" TEXT[],
    "hasContactForm" BOOLEAN NOT NULL DEFAULT false,
    "hasWhatsAppWidget" BOOLEAN NOT NULL DEFAULT false,
    "hasLiveChat" BOOLEAN NOT NULL DEFAULT false,
    "hasSslCertificate" BOOLEAN NOT NULL DEFAULT false,
    "isMobileResponsive" BOOLEAN NOT NULL DEFAULT false,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "instagramHandle" TEXT,
    "instagramFollowers" INTEGER,
    "instagramBio" TEXT,
    "linkedinUrl" TEXT,
    "twitterUrl" TEXT,
    "youtubeUrl" TEXT,
    "tiktokUrl" TEXT,
    "enrichedAt" TIMESTAMP(3),
    "enrichmentScore" INTEGER,
    "enrichmentSources" TEXT[],
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "estimatedRevenue" TEXT NOT NULL DEFAULT 'Medium',
    "painPoints" TEXT[],
    "opportunities" TEXT[],
    "techStack" TEXT,
    "nearbyCompetitors" INTEGER NOT NULL DEFAULT 0,
    "competitorsWithWeb" INTEGER NOT NULL DEFAULT 0,
    "competitorAvgRating" DOUBLE PRECISION,
    "outreachStatus" TEXT NOT NULL DEFAULT 'new',
    "lastContactAt" TIMESTAMP(3),
    "notes" TEXT,
    "tags" TEXT[],
    "searchKeyword" TEXT NOT NULL,
    "searchLocation" TEXT NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keyword" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "radius" INTEGER NOT NULL,
    "resultsFound" INTEGER NOT NULL,
    "leadsCreated" INTEGER NOT NULL,
    "apiCost" DOUBLE PRECISION,
    "duration" INTEGER,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geocodingCalls" INTEGER NOT NULL DEFAULT 0,
    "nearbySearchCalls" INTEGER NOT NULL DEFAULT 0,
    "placeDetailsCalls" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_placeId_key" ON "Lead"("placeId");

-- CreateIndex
CREATE INDEX "Lead_leadScore_idx" ON "Lead"("leadScore" DESC);

-- CreateIndex
CREATE INDEX "Lead_outreachStatus_idx" ON "Lead"("outreachStatus");

-- CreateIndex
CREATE INDEX "Lead_searchKeyword_searchLocation_idx" ON "Lead"("searchKeyword", "searchLocation");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_hasWebsite_idx" ON "Lead"("hasWebsite");

-- CreateIndex
CREATE INDEX "Lead_googleRating_idx" ON "Lead"("googleRating" DESC);

-- CreateIndex
CREATE INDEX "SearchHistory_createdAt_idx" ON "SearchHistory"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsage_date_key" ON "ApiUsage"("date");
