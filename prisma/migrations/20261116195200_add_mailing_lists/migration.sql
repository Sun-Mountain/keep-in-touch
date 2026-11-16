CREATE TABLE "MailingList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailingList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MailingListContact" (
    "mailingListId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,

    CONSTRAINT "MailingListContact_pkey" PRIMARY KEY ("mailingListId", "contactId")
);

CREATE UNIQUE INDEX "MailingList_userId_normalizedName_key"
ON "MailingList"("userId", "normalizedName");

CREATE INDEX "MailingList_userId_createdAt_idx"
ON "MailingList"("userId", "createdAt");

CREATE INDEX "MailingListContact_contactId_idx"
ON "MailingListContact"("contactId");

ALTER TABLE "MailingList"
ADD CONSTRAINT "MailingList_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MailingListContact"
ADD CONSTRAINT "MailingListContact_mailingListId_fkey"
FOREIGN KEY ("mailingListId") REFERENCES "MailingList"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MailingListContact"
ADD CONSTRAINT "MailingListContact_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
