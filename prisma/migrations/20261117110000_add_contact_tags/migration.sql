CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactTag" (
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("contactId", "tagId")
);

CREATE UNIQUE INDEX "Tag_userId_normalizedName_key"
ON "Tag"("userId", "normalizedName");

CREATE INDEX "Tag_userId_name_idx"
ON "Tag"("userId", "name");

CREATE INDEX "ContactTag_tagId_idx"
ON "ContactTag"("tagId");

ALTER TABLE "Tag"
ADD CONSTRAINT "Tag_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactTag"
ADD CONSTRAINT "ContactTag_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactTag"
ADD CONSTRAINT "ContactTag_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
