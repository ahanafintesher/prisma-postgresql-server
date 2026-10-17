import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  const [
    admins,
    roles,
    companies,
    plans,
    subscriptions,
    payments,
    promotions,
    tickets,
    messages,
    announcements,
    auditLogs,
    settings,
  ] = await Promise.all([
    prisma.platformAdmin.count(),
    prisma.platformRole.count(),
    prisma.company.count(),
    prisma.plan.count(),
    prisma.subscription.count(),
    prisma.payment.count(),
    prisma.promotion.count(),
    prisma.supportTicket.count(),
    prisma.ticketMessage.count(),
    prisma.announcement.count(),
    prisma.auditLog.count(),
    prisma.systemSetting.count(),
  ]);

  console.log("Current Database Record Counts:");
  console.log(
    JSON.stringify(
      {
        admins,
        roles,
        companies,
        plans,
        subscriptions,
        payments,
        promotions,
        tickets,
        messages,
        announcements,
        auditLogs,
        settings,
      },
      null,
      2
    )
  );

  process.exit(0);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
