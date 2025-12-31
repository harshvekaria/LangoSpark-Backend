-- CreateTable
CREATE TABLE "ConversationExchange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationExchange_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConversationExchange" ADD CONSTRAINT "ConversationExchange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationExchange" ADD CONSTRAINT "ConversationExchange_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
