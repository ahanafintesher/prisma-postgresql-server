import prisma from "../src/lib/prisma";
import { invalidateCacheCategory } from "../src/lib/redis";

async function seedCompanies() {
  console.log("Seeding 25 realistic companies for pagination testing...");

  const starterVersion = await prisma.planVersion.findFirst({
    where: { plan: { slug: "starter" } },
  });
  const proVersion = await prisma.planVersion.findFirst({
    where: { plan: { slug: "professional" } },
  });
  const entVersion = await prisma.planVersion.findFirst({
    where: { plan: { slug: "enterprise" } },
  });

  const companiesData = [
    { name: "Acme Corporation", slug: "acme-corp", ownerEmail: "admin@acmecorp.com", status: "ACTIVE", verificationStatus: "VERIFIED", plan: starterVersion },
    { name: "Nexus Tech Labs", slug: "nexus-tech", ownerEmail: "ops@nexustech.io", status: "ACTIVE", verificationStatus: "VERIFIED", plan: entVersion },
    { name: "Horizon Logistics", slug: "horizon-logistics", ownerEmail: "fleet@horizonlogistics.com", status: "ACTIVE", verificationStatus: "VERIFIED", plan: proVersion },
    { name: "Lumina Creative Agency", slug: "lumina-creative", ownerEmail: "hello@luminacreative.studio", status: "ACTIVE", verificationStatus: "PENDING", plan: starterVersion },
    { name: "Apex Financial Partners", slug: "apex-financial", ownerEmail: "security@apexfinancial.com", status: "ACTIVE", verificationStatus: "VERIFIED", plan: entVersion },
    { name: "Quantum Health Systems", slug: "quantum-health", ownerEmail: "compliance@quantumhealth.org", status: "ACTIVE", verificationStatus: "VERIFIED", plan: entVersion },
    { name: "CyberShield Dynamics", slug: "cybershield-dyn", ownerEmail: "soc@cybershield.io", status: "ACTIVE", verificationStatus: "VERIFIED", plan: proVersion },
    { name: "Global Trade Alliance", slug: "global-trade", ownerEmail: "trade@globaltradealliance.com", status: "SUSPENDED", verificationStatus: "VERIFIED", plan: starterVersion, suspensionReason: "Overdue invoice exceeding 60-day billing grace period" },
    { name: "BluePeak Innovations", slug: "bluepeak-innovations", ownerEmail: "contact@bluepeak.dev", status: "ACTIVE", verificationStatus: "UNVERIFIED", plan: starterVersion },
    { name: "Velocity Mobile Solutions", slug: "velocity-mobile", ownerEmail: "devops@velocitymobile.app", status: "ACTIVE", verificationStatus: "VERIFIED", plan: proVersion },
    { name: "IronClad Manufacturing", slug: "ironclad-mfg", ownerEmail: "plant@ironcladmfg.com", status: "ACTIVE", verificationStatus: "PENDING", plan: proVersion },
    { name: "Starlight Media Group", slug: "starlight-media", ownerEmail: "editorial@starlightmedia.tv", status: "ACTIVE", verificationStatus: "VERIFIED", plan: proVersion },
    { name: "OmniCorp Global", slug: "omnicorp-global", ownerEmail: "enterprise@omnicorpglobal.com", status: "ACTIVE", verificationStatus: "VERIFIED", plan: entVersion },
    { name: "Vanguard Energy Solutions", slug: "vanguard-energy", ownerEmail: "grid@vanguardenergy.com", status: "ACTIVE", verificationStatus: "VERIFIED", plan: entVersion },
    { name: "Pulse BioTech", slug: "pulse-biotech", ownerEmail: "research@pulsebiotech.com", status: "PENDING", verificationStatus: "PENDING", plan: starterVersion },
    { name: "TerraGreen EcoSystems", slug: "terragreen-eco", ownerEmail: "sustainability@terragreen.earth", status: "ACTIVE", verificationStatus: "VERIFIED", plan: starterVersion },
    { name: "Helios Robotics", slug: "helios-robotics", ownerEmail: "ai@heliosrobotics.tech", status: "ACTIVE", verificationStatus: "VERIFIED", plan: entVersion },
    { name: "CloudScale Networks", slug: "cloudscale-net", ownerEmail: "noc@cloudscalenet.com", status: "ACTIVE", verificationStatus: "VERIFIED", plan: proVersion },
    { name: "AlphaStream AI", slug: "alphastream-ai", ownerEmail: "ml@alphastream.ai", status: "ACTIVE", verificationStatus: "VERIFIED", plan: proVersion },
    { name: "Summit Retail Group", slug: "summit-retail", ownerEmail: "pos@summitretail.com", status: "ACTIVE", verificationStatus: "VERIFIED", plan: starterVersion },
    { name: "Orbit Aerospace", slug: "orbit-aerospace", ownerEmail: "mission@orbitaero.space", status: "ACTIVE", verificationStatus: "VERIFIED", plan: entVersion },
    { name: "Phoenix Insurance Corp", slug: "phoenix-insurance", ownerEmail: "underwriting@phoenixins.com", status: "SUSPENDED", verificationStatus: "VERIFIED", plan: proVersion, suspensionReason: "Terms of service compliance review pending" },
    { name: "Beacon Education Hub", slug: "beacon-edu", ownerEmail: "registrar@beaconedu.org", status: "ACTIVE", verificationStatus: "VERIFIED", plan: starterVersion },
    { name: "Sterling Legal Partners", slug: "sterling-legal", ownerEmail: "counsel@sterlinglegal.law", status: "ACTIVE", verificationStatus: "VERIFIED", plan: proVersion },
    { name: "ZenWork Coworking", slug: "zenwork-spaces", ownerEmail: "facilities@zenwork.space", status: "ACTIVE", verificationStatus: "REJECTED", plan: starterVersion },
  ];

  for (let i = 0; i < companiesData.length; i++) {
    const item = companiesData[i];
    const company = await prisma.company.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        ownerEmail: item.ownerEmail,
        status: item.status as any,
        verificationStatus: item.verificationStatus as any,
        verifiedAt: item.verificationStatus === "VERIFIED" ? new Date() : null,
        suspensionReason: (item as any).suspensionReason || null,
        suspendedAt: (item as any).suspensionReason ? new Date() : null,
      },
      create: {
        name: item.name,
        slug: item.slug,
        ownerEmail: item.ownerEmail,
        status: item.status as any,
        verificationStatus: item.verificationStatus as any,
        verifiedAt: item.verificationStatus === "VERIFIED" ? new Date() : null,
        suspensionReason: (item as any).suspensionReason || null,
        suspendedAt: (item as any).suspensionReason ? new Date() : null,
      },
    });

    if (item.plan) {
      const start = new Date();
      start.setDate(start.getDate() - (i * 2));
      const end = new Date(start);
      end.setDate(end.getDate() + 30);

      await prisma.subscription.upsert({
        where: { id: `sub-${item.slug}` },
        update: {
          planVersionId: item.plan.id,
          status: item.status === "ACTIVE" ? "ACTIVE" : "PAST_DUE",
        },
        create: {
          id: `sub-${item.slug}`,
          companyId: company.id,
          planVersionId: item.plan.id,
          billingInterval: i % 3 === 0 ? "ANNUAL" : "MONTHLY",
          status: item.status === "ACTIVE" ? "ACTIVE" : "PAST_DUE",
          currentPeriodStart: start,
          currentPeriodEnd: end,
        },
      });

      // Seed a payment for this company
      await prisma.payment.upsert({
        where: { idempotencyKey: `idemp-${item.slug}` },
        update: {},
        create: {
          id: `pay-${item.slug}`,
          companyId: company.id,
          gateway: i % 2 === 0 ? "STRIPE" : "SSLCOMMERZ",
          amount: (item.plan as any).monthlyPrice || 4900,
          currency: "USD",
          status: "SUCCEEDED",
          transactionRef: `tx-init-${item.slug}`,
          idempotencyKey: `idemp-${item.slug}`,
          createdAt: start,
        },
      });
    }
  }

  await invalidateCacheCategory("companies");
  await invalidateCacheCategory("subscriptions");
  await invalidateCacheCategory("payments");
  await invalidateCacheCategory("dashboard");

  console.log("Seeded 25 companies with subscriptions and payments! Cache invalidated.");
}

seedCompanies()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
