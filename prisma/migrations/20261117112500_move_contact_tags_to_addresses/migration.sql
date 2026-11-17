CREATE TABLE "AddressTag" (
    "userId" TEXT NOT NULL,
    "addressFingerprint" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "AddressTag_pkey" PRIMARY KEY ("userId", "addressFingerprint", "tagId")
);

CREATE INDEX "AddressTag_tagId_idx"
ON "AddressTag"("tagId");

ALTER TABLE "AddressTag"
ADD CONSTRAINT "AddressTag_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AddressTag"
ADD CONSTRAINT "AddressTag_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
