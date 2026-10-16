import bcrypt from "bcrypt";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("Seeding WorkSphere initial roles and permissions...");

  // 1. Seed Platform Permissions
  const permissionsData = [
    { key: "platform.dashboard.view", description: "View Platform KPI overview", category: "Dashboard" },
    { key: "platform.companies.view", description: "View tenant company directory and details", category: "Companies" },
    { key: "platform.companies.manage", description: "Provision and update company metadata", category: "Companies" },
    { key: "platform.companies.verify", description: "Approve or reject tenant KYB verification", category: "Companies" },
    { key: "platform.companies.suspend", description: "Suspend or reactivate tenant companies", category: "Companies" },
    { key: "platform.plans.manage", description: "Manage subscription tiers and pricing", category: "Billing" },
    { key: "platform.subscriptions.manage", description: "Manage tenant subscriptions and trial extensions", category: "Billing" },
    { key: "platform.payments.view", description: "View transaction records and gateway logs", category: "Billing" },
    { key: "platform.payments.refund", description: "Issue transaction refunds", category: "Billing" },
    { key: "platform.tickets.reply", description: "Reply to customer support tickets", category: "Support" },
    { key: "platform.tickets.notes", description: "Write internal support staff notes", category: "Support" },
    { key: "platform.announcements.manage", description: "Create and publish broadcast announcements", category: "Support" },
    { key: "platform.admins.manage", description: "Manage operator accounts and invitations", category: "Governance" },
    { key: "platform.roles.manage", description: "Manage RBAC roles and permissions", category: "Governance" },
    { key: "platform.audit.view", description: "View immutable system audit logs", category: "Governance" },
    { key: "platform.audit.export", description: "Export audit logs to CSV or JSON", category: "Governance" },
    { key: "platform.system.health", description: "View system telemetry and infrastructure health", category: "DevOps" },
    { key: "platform.system.jobs", description: "Monitor and retry background jobs & webhooks", category: "DevOps" },
    { key: "platform.settings.manage", description: "Configure global platform settings", category: "Settings" },
  ];

  for (const perm of permissionsData) {
    await prisma.platformPermission.upsert({
      where: { key: perm.key },
      update: { description: perm.description, category: perm.category },
      create: perm,
    });
  }

  // 2. Seed Platform Roles (RBAC Matrix from requirements-final.md)
  const rootRole = await prisma.platformRole.upsert({
    where: { slug: "super-admin-root" },
    update: {},
    create: {
      name: "Super Admin (Root)",
      slug: "super-admin-root",
      description: "Full, unrestricted access across all WorkSphere platform modules",
      isSystem: true,
    },
  });

  const supportRole = await prisma.platformRole.upsert({
    where: { slug: "support-specialist" },
    update: {},
    create: {
      name: "Support Specialist",
      slug: "support-specialist",
      description: "Customer service operator handling tickets and verification queues",
      isSystem: true,
    },
  });

  const billingRole = await prisma.platformRole.upsert({
    where: { slug: "billing-manager" },
    update: {},
    create: {
      name: "Billing Manager",
      slug: "billing-manager",
      description: "Financial administrator managing plans, subscriptions, and refunds",
      isSystem: true,
    },
  });

  const auditorRole = await prisma.platformRole.upsert({
    where: { slug: "compliance-auditor" },
    update: {},
    create: {
      name: "Compliance Auditor",
      slug: "compliance-auditor",
      description: "Read-only auditor with access to telemetry and immutable audit logs",
      isSystem: true,
    },
  });

  // Assign permissions to Super Admin (all permissions)
  const allPermissions = await prisma.platformPermission.findMany();
  for (const perm of allPermissions) {
    await prisma.platformRolePermission.upsert({
      where: {
        roleId_permissionKey: {
          roleId: rootRole.id,
          permissionKey: perm.key,
        },
      },
      update: {},
      create: {
        roleId: rootRole.id,
        permissionKey: perm.key,
      },
    });
  }

  // 3. Seed Root Super Admin User
  const defaultPasswordHash = await bcrypt.hash("Admin@WorkSphere2026!", 10);
  const defaultAdmin = await prisma.platformAdmin.upsert({
    where: { email: "admin@worksphere.com" },
    update: {},
    create: {
      email: "admin@worksphere.com",
      name: "Super Admin Operator",
      password: defaultPasswordHash,
      roleId: rootRole.id,
      status: "ACTIVE",
      mfaEnabled: false,
    },
  });
  console.log(`Seeded Super Admin user: ${defaultAdmin.email}`);

  // 4. Seed Standard SaaS Subscription Plans
  const plansData = [
    {
      name: "Starter",
      slug: "starter",
      description: "Ideal for small teams and growing startups up to 25 employees",
      monthlyPrice: 4900, // $49.00
      annualPrice: 47000, // $470.00 / yr (~$39.16/mo)
      currency: "USD",
      maxEmployees: 25,
      maxProjects: 10,
      features: {
        timeTracking: true,
        geoFencing: false,
        advancedTelemetry: false,
        prioritySupport: false,
        exportReports: true,
      },
    },
    {
      name: "Professional",
      slug: "professional",
      description: "Comprehensive workforce management for companies up to 100 employees",
      monthlyPrice: 14900, // $149.00
      annualPrice: 143000, // $1,430.00 / yr
      currency: "USD",
      maxEmployees: 100,
      maxProjects: 50,
      features: {
        timeTracking: true,
        geoFencing: true,
        advancedTelemetry: true,
        prioritySupport: false,
        exportReports: true,
        apiAccess: true,
      },
    },
    {
      name: "Enterprise",
      slug: "enterprise",
      description: "Full-scale corporate intelligence, SLA support, and unlimited scalability",
      monthlyPrice: 39900, // $399.00
      annualPrice: 383000, // $3,830.00 / yr
      currency: "USD",
      maxEmployees: 500,
      maxProjects: 200,
      features: {
        timeTracking: true,
        geoFencing: true,
        advancedTelemetry: true,
        prioritySupport: true,
        exportReports: true,
        apiAccess: true,
        dedicatedAccountManager: true,
        customIntegrations: true,
      },
    },
  ];

  for (const plan of plansData) {
    const createdPlan = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {},
      create: {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        currency: plan.currency,
        maxEmployees: plan.maxEmployees,
        maxProjects: plan.maxProjects,
        features: plan.features,
      },
    });

    await prisma.planVersion.upsert({
      where: { id: `${createdPlan.id}-v1` },
      update: {},
      create: {
        id: `${createdPlan.id}-v1`,
        planId: createdPlan.id,
        version: 1,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        currency: plan.currency,
        maxEmployees: plan.maxEmployees,
        maxProjects: plan.maxProjects,
        features: plan.features,
      },
    });
  }

  // 5. Seed Demo Tenant Company
  const demoCompany = await prisma.company.upsert({
    where: { slug: "acme-corp" },
    update: {},
    create: {
      name: "Acme Corporation",
      slug: "acme-corp",
      ownerEmail: "owner@acmecorp.com",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      verifiedAt: new Date(),
    },
  });

  const starterVersion = await prisma.planVersion.findFirst({
    where: { plan: { slug: "starter" } },
  });

  if (starterVersion) {
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodStart.getDate() + 30);

    await prisma.subscription.upsert({
      where: { id: "demo-subscription-1" },
      update: {},
      create: {
        id: "demo-subscription-1",
        companyId: demoCompany.id,
        planVersionId: starterVersion.id,
        billingInterval: "MONTHLY",
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  console.log("Database seeded successfully with WorkSphere baseline data!");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
