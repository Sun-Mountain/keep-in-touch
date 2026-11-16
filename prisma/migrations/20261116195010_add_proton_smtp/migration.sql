CREATE TABLE "ProtonConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedSmtpToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtonConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProtonConnection_userId_key"
ON "ProtonConnection"("userId");

ALTER TABLE "ProtonConnection"
ADD CONSTRAINT "ProtonConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
