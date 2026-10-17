import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../src/lib/prisma";
import { invalidateCacheCategory } from "../src/lib/redis";

async function seedComprehensiveData() {
  console.log("=== SEEDING COMPREHENSIVE DUMMY DATA FOR SUPER ADMIN ===");

  // 1. Seed Platform Operator Admins
  console.log("[1/7] Seeding Platform Operator Accounts...");
  const rootRole = await prisma.platformRole.findUnique({ where: { slug: "super-admin-root" } });
  const supportRole = await prisma.platformRole.findUnique({ where: { slug: "support-specialist" } });
  const billingRole = await prisma.platformRole.findUnique({ where: { slug: "billing-manager" } });
  const auditorRole = await prisma.platformRole.findUnique({ where: { slug: "compliance-auditor" } });

  const defaultPassword = await bcrypt.hash("Admin@WorkSphere2026!", 10);

  const adminUsers = [
    {
      email: "sarah.support@worksphere.com",
      name: "Sarah Jenkins",
      roleId: supportRole?.id || rootRole?.id!,
      status: "ACTIVE" as const,
      mfaEnabled: true,
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    },
    {
      email: "marcus.finance@worksphere.com",
      name: "Marcus Vance",
      roleId: billingRole?.id || rootRole?.id!,
      status: "ACTIVE" as const,
      mfaEnabled: false,
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    },
    {
      email: "elena.audit@worksphere.com",
      name: "Elena Rostova",
      roleId: auditorRole?.id || rootRole?.id!,
      status: "ACTIVE" as const,
      mfaEnabled: true,
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    },
    {
      email: "david.chen@worksphere.com",
      name: "David Chen",
      roleId: rootRole?.id!,
      status: "ACTIVE" as const,
      mfaEnabled: false,
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    },
  ];

  for (const admin of adminUsers) {
    await prisma.platformAdmin.upsert({
      where: { email: admin.email },
      update: {
        name: admin.name,
        roleId: admin.roleId,
        status: admin.status,
        mfaEnabled: admin.mfaEnabled,
        avatarUrl: admin.avatarUrl,
      },
      create: {
        email: admin.email,
        name: admin.name,
        password: defaultPassword,
        roleId: admin.roleId,
        status: admin.status,
        mfaEnabled: admin.mfaEnabled,
        avatarUrl: admin.avatarUrl,
        lastLoginAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 5)),
        lastLoginIp: "192.168.1.10" + Math.floor(Math.random() * 9),
      },
    });
  }

  // 2. Seed System Settings & Policies
  console.log("[2/7] Seeding Platform Settings & Security Policy...");
  const settingsList = [
    {
      key: "platform_general",
      value: {
        platformName: "WorkSphere EMS Enterprise",
        supportEmail: "support@worksphere.io",
        defaultCurrency: "USD",
        maintenanceMode: false,
        maxTrialDays: 14,
        enforceEmailVerification: true,
      },
      isSecret: false,
      description: "General Platform Settings & Operational Parameters",
    },
    {
      key: "security_policy",
      value: {
        mfaEnforcedForAll: false,
        sessionTimeoutMinutes: 60,
        maxFailedLoginAttempts: 5,
        ipAllowlist: ["127.0.0.1", "::1", "10.0.0.0/8", "192.168.1.0/24"],
      },
      isSecret: false,
      description: "Global Platform Security & Session Governance Policy",
    },
    {
      key: "billing_gateways",
      value: {
        stripeActive: true,
        sslcommerzActive: true,
        bkashActive: true,
        defaultGateway: "STRIPE",
        webhookEndpoint: "https://api.worksphere.io/webhooks/billing",
      },
      isSecret: false,
      description: "Payment Gateway Aggregator Configuration",
    },
    {
      key: "stripe_api_credentials",
      value: {
        publishableKey: "pk_test_51MzWorkSphereLiveSandboxKey998",
        secretKey: "sk_test_SECRET_TOKEN_DO_NOT_EXPOSE",
        webhookSecret: "whsec_STRIPE_WEBHOOK_SECRET_KEY",
      },
      isSecret: true,
      description: "Encrypted Stripe Payment Processor Keys",
    },
  ];

  for (const s of settingsList) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, isSecret: s.isSecret, description: s.description },
      create: { key: s.key, value: s.value, isSecret: s.isSecret, description: s.description },
    });
  }

  // 3. Seed Promotional Coupons
  console.log("[3/7] Seeding Promotional Coupons...");
  const now = new Date();
  const future30d = new Date(now.getTime() + 30 * 86400000);
  const future90d = new Date(now.getTime() + 90 * 86400000);
  const past30d = new Date(now.getTime() - 30 * 86400000);

  const promotionsList = [
    {
      code: "LAUNCH2026",
      description: "25% discount for early platform adopters across all annual tiers",
      discountType: "PERCENTAGE" as const,
      discountValue: 25,
      validUntil: future90d,
      maxRedemptions: 500,
      timesRedeemed: 142,
      isActive: true,
    },
    {
      code: "STARTUP50",
      description: "50% off first 3 months for early-stage startups and accelerators",
      discountType: "PERCENTAGE" as const,
      discountValue: 50,
      validUntil: future30d,
      maxRedemptions: 100,
      timesRedeemed: 78,
      isActive: true,
    },
    {
      code: "ENTERPRISE1000",
      description: "$1,000 flat discount for annual Enterprise contract signing",
      discountType: "FIXED_AMOUNT" as const,
      discountValue: 100000, // in cents ($1,000)
      validUntil: future90d,
      maxRedemptions: 25,
      timesRedeemed: 9,
      isActive: true,
    },
    {
      code: "SUMMERBOOST",
      description: "15% off workforce growth licenses during summer expansion",
      discountType: "PERCENTAGE" as const,
      discountValue: 15,
      validUntil: future30d,
      maxRedemptions: 200,
      timesRedeemed: 64,
      isActive: true,
    },
    {
      code: "NONPROFIT30",
      description: "30% permanent discount for verified non-profit organizations",
      discountType: "PERCENTAGE" as const,
      discountValue: 30,
      validUntil: null,
      maxRedemptions: 50,
      timesRedeemed: 12,
      isActive: true,
    },
    {
      code: "BLACKFRIDAY2025",
      description: "Expired Black Friday 2025 flash promotion campaign",
      discountType: "PERCENTAGE" as const,
      discountValue: 40,
      validUntil: past30d,
      maxRedemptions: 200,
      timesRedeemed: 200,
      isActive: false,
    },
  ];

  for (const promo of promotionsList) {
    await prisma.promotion.upsert({
      where: { code: promo.code },
      update: {
        description: promo.description,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        validUntil: promo.validUntil,
        maxRedemptions: promo.maxRedemptions,
        timesRedeemed: promo.timesRedeemed,
        isActive: promo.isActive,
      },
      create: promo,
    });
  }

  // 4. Seed Broadcast Announcements
  console.log("[4/7] Seeding Platform Announcements...");
  const announcementsList = [
    {
      title: "Scheduled Neon PostgreSQL Maintenance - Sunday 02:00 UTC",
      content: "Neon Serverless will perform non-disruptive storage compaction. Connection pooling latency may increase by ~15ms during this 10-minute window.",
      type: "MAINTENANCE" as const,
      targetAudience: "ALL",
      isPublished: true,
      publishedAt: new Date(now.getTime() - 2 * 86400000),
      expiresAt: future30d,
    },
    {
      title: "BullMQ Distributed Background Worker Cluster (v2.4) Deployed",
      content: "All transactional email dispatch, automated invoice generation, and KYB document OCR queues are now processing asynchronously with sub-50ms queue latency.",
      type: "INFO" as const,
      targetAudience: "ALL",
      isPublished: true,
      publishedAt: new Date(now.getTime() - 5 * 86400000),
      expiresAt: future90d,
    },
    {
      title: "Mandatory Two-Factor Authentication (2FA) Notice for Enterprise Admins",
      content: "Effective November 1st, all administrative accounts with billing or user management permissions must configure TOTP 2FA per platform security governance.",
      type: "WARNING" as const,
      targetAudience: "ALL",
      isPublished: true,
      publishedAt: new Date(now.getTime() - 1 * 86400000),
      expiresAt: future90d,
    },
    {
      title: "Upcoming Holiday Financial Reconciliation Schedule",
      content: "Scheduled banking settlement freeze from December 24 to 26. Automatic gateway card charges continue unaffected.",
      type: "INFO" as const,
      targetAudience: "ALL",
      isPublished: false,
      publishedAt: null,
      expiresAt: null,
    },
  ];

  for (const ann of announcementsList) {
    const existing = await prisma.announcement.findFirst({ where: { title: ann.title } });
    if (!existing) {
      await prisma.announcement.create({ data: ann });
    }
  }

  // 5. Enrich Tenant Companies with KYB Documents & Statuses
  console.log("[5/7] Enriching Tenant Companies with KYB Verification Documents...");
  const companies = await prisma.company.findMany({ take: 25 });
  const docTemplates = [
    { taxId: "US-8841920", regNum: "DEL-2022-891", country: "United States", certUrl: "https://storage.worksphere.io/kyb/cert-us.pdf" },
    { taxId: "GB-9012384", regNum: "UK-CH-102934", country: "United Kingdom", certUrl: "https://storage.worksphere.io/kyb/cert-uk.pdf" },
    { taxId: "SG-2020192A", regNum: "ACRA-2020-001", country: "Singapore", certUrl: "https://storage.worksphere.io/kyb/cert-sg.pdf" },
    { taxId: "BD-0091283", regNum: "RJSC-BD-7712", country: "Bangladesh", certUrl: "https://storage.worksphere.io/kyb/cert-bd.pdf" },
  ];

  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    const doc = docTemplates[i % docTemplates.length];
    await prisma.company.update({
      where: { id: c.id },
      data: {
        verificationDocuments: {
          taxId: doc.taxId,
          registrationNumber: doc.regNum,
          country: doc.country,
          incorporationCertificateUrl: doc.certUrl,
          directorIdentificationUrl: "https://storage.worksphere.io/kyb/id-passport.pdf",
          submittedAt: new Date(Date.now() - (i + 1) * 86400000 * 2).toISOString(),
        },
      },
    });
  }

  // 6. Seed Support Tickets & Messages
  console.log("[6/7] Seeding Support Tickets & Thread Messages...");
  const sarahAdmin = await prisma.platformAdmin.findUnique({ where: { email: "sarah.support@worksphere.com" } });
  const davidAdmin = await prisma.platformAdmin.findUnique({ where: { email: "david.chen@worksphere.com" } });

  const ticketsData = [
    {
      companySlug: "acme-corp",
      subject: "Urgent: SSLCommerz Webhook Callback Verification Timeout",
      priority: "URGENT" as const,
      status: "OPEN" as const,
      slaBreached: false,
      assignedAdminId: sarahAdmin?.id || null,
      messages: [
        {
          authorRole: "CLIENT",
          authorId: "acme-owner",
          isInternalNote: false,
          messageBody: "We encountered 3 failed transaction notifications where the SSLCommerz IPN webhook did not verify within 5 seconds. Can engineering check our webhook gateway endpoint?",
        },
        {
          authorRole: "SUPPORT",
          authorId: sarahAdmin?.id || "support-agent",
          isInternalNote: true,
          messageBody: "Checked BullMQ logs: worker retried twice and succeeded on 3rd attempt. Customer endpoint has a cold start latency of 4.2s. Recommending keep-alive ping.",
        },
        {
          authorRole: "SUPPORT",
          authorId: sarahAdmin?.id || "support-agent",
          isInternalNote: false,
          messageBody: "Hello Acme team, our diagnostic logs indicate the callbacks succeeded on automatic retry. We have whitelisted your IP block and increased the timeout threshold to 10 seconds.",
        },
      ],
    },
    {
      companySlug: "nexus-tech",
      subject: "Requesting plan expansion to 1,000 workforce seats before Q4 hiring",
      priority: "HIGH" as const,
      status: "IN_PROGRESS" as const,
      slaBreached: false,
      assignedAdminId: davidAdmin?.id || null,
      messages: [
        {
          authorRole: "CLIENT",
          authorId: "nexus-ops",
          isInternalNote: false,
          messageBody: "Our current Enterprise plan is capped at 500 employee profiles. We are scaling our engineering division by 350 heads in November. Please provide custom tier pricing.",
        },
        {
          authorRole: "SUPPORT",
          authorId: davidAdmin?.id || "support-agent",
          isInternalNote: false,
          messageBody: "Hi Nexus Tech team, we have received your custom quota request. Our enterprise solutions manager is preparing a customized addendum for your review.",
        },
      ],
    },
    {
      companySlug: "horizon-logistics",
      subject: "Cross-border driver biometric timecard sync discrepancy on iOS 18",
      priority: "MEDIUM" as const,
      status: "OPEN" as const,
      slaBreached: false,
      assignedAdminId: sarahAdmin?.id || null,
      messages: [
        {
          authorRole: "CLIENT",
          authorId: "horizon-fleet",
          isInternalNote: false,
          messageBody: "Drivers crossing timezones in Southeast Asia report biometric punch timestamps being shifted by +1 hour when offline queue syncs upon reconnecting.",
        },
      ],
    },
    {
      companySlug: "lumina-creative",
      subject: "KYB Document Review - Trade License Renewal Submitted",
      priority: "MEDIUM" as const,
      status: "IN_PROGRESS" as const,
      slaBreached: false,
      assignedAdminId: sarahAdmin?.id || null,
      messages: [
        {
          authorRole: "CLIENT",
          authorId: "lumina-admin",
          isInternalNote: false,
          messageBody: "We have re-uploaded our 2026 renewed trade license for Lumina Creative Studio. Please review to lift the verification warning.",
        },
      ],
    },
    {
      companySlug: "apex-financial",
      subject: "Audit Log Compliance Export - Requesting 365-day SOC2 Archive",
      priority: "LOW" as const,
      status: "RESOLVED" as const,
      slaBreached: false,
      assignedAdminId: davidAdmin?.id || null,
      messages: [
        {
          authorRole: "CLIENT",
          authorId: "apex-sec",
          isInternalNote: false,
          messageBody: "Our SOC2 Type II auditor requires the complete SHA-256 signed audit stream for fiscal year 2025. Please generate the signed archive.",
        },
        {
          authorRole: "SUPPORT",
          authorId: davidAdmin?.id || "support-agent",
          isInternalNote: false,
          messageBody: "The signed compliance export has been generated and uploaded to your secure S3 delivery vault. Archive checksum SHA256 verified.",
        },
      ],
    },
    {
      companySlug: "quantum-health",
      subject: "HIPAA Dedicated Database Isolation & Data Residency Verification",
      priority: "HIGH" as const,
      status: "RESOLVED" as const,
      slaBreached: false,
      assignedAdminId: davidAdmin?.id || null,
      messages: [
        {
          authorRole: "CLIENT",
          authorId: "quantum-admin",
          isInternalNote: false,
          messageBody: "Confirming that all patient-facing staff attendance records remain strictly within the AWS ap-southeast-1 region with TLS 1.3 encryption in transit.",
        },
        {
          authorRole: "SUPPORT",
          authorId: davidAdmin?.id || "support-agent",
          isInternalNote: false,
          messageBody: "Verified. Neon PostgreSQL serverless instances are pinned to AWS ap-southeast-1 with customer-managed KMS encryption keys.",
        },
      ],
    },
    {
      companySlug: "global-trade",
      subject: "Account Suspension Appeal - Invoice INV-2026-089 Settlement Proof",
      priority: "HIGH" as const,
      status: "OPEN" as const,
      slaBreached: true,
      assignedAdminId: sarahAdmin?.id || null,
      messages: [
        {
          authorRole: "CLIENT",
          authorId: "gt-admin",
          isInternalNote: false,
          messageBody: "We have wired the outstanding $490.00 invoice via international SWIFT wire. Attached bank remittance receipt. Please reactivate tenant access.",
        },
      ],
    },
    {
      companySlug: "velocity-mobile",
      subject: "Geofencing false-positives around downtown high-rise urban canyons",
      priority: "LOW" as const,
      status: "CLOSED" as const,
      slaBreached: false,
      assignedAdminId: sarahAdmin?.id || null,
      messages: [
        {
          authorRole: "CLIENT",
          authorId: "vm-ops",
          isInternalNote: false,
          messageBody: "GPS drift inside skyscrapers caused 4 false-positive out-of-bounds notifications this morning.",
        },
        {
          authorRole: "SUPPORT",
          authorId: sarahAdmin?.id || "support-agent",
          isInternalNote: false,
          messageBody: "Enabled WiFi/Cell tower triangulation fallback in platform settings. Problem resolved.",
        },
      ],
    },
  ];

  for (const t of ticketsData) {
    const comp = await prisma.company.findUnique({ where: { slug: t.companySlug } });
    if (!comp) continue;

    const existingTicket = await prisma.supportTicket.findFirst({
      where: { companyId: comp.id, subject: t.subject },
    });

    let ticketId: string;
    if (existingTicket) {
      ticketId = existingTicket.id;
    } else {
      const createdTicket = await prisma.supportTicket.create({
        data: {
          companyId: comp.id,
          subject: t.subject,
          priority: t.priority,
          status: t.status,
          slaBreached: t.slaBreached,
          requesterEmail: comp.ownerEmail,
          assignedAdminId: t.assignedAdminId,
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 7)),
        },
      });
      ticketId = createdTicket.id;
    }

    // Seed messages if not already present
    const messageCount = await prisma.ticketMessage.count({ where: { ticketId } });
    if (messageCount === 0) {
      for (let m = 0; m < t.messages.length; m++) {
        const msg = t.messages[m];
        await prisma.ticketMessage.create({
          data: {
            ticketId,
            authorId: msg.authorId,
            authorRole: msg.authorRole,
            isInternalNote: msg.isInternalNote,
            messageBody: msg.messageBody,
            createdAt: new Date(Date.now() - (t.messages.length - m) * 3600000),
          },
        });
      }
    }
  }

  // 7. Seed Diverse Historical Payments (Refunded, Failed, Succeeded)
  console.log("[7/7] Seeding Diverse Payment Transactions & Refunds...");
  const allCompanies = await prisma.company.findMany({ take: 10 });
  const paymentVariations = [
    {
      companySlug: "acme-corp",
      amount: 4900,
      status: "REFUNDED" as const,
      gateway: "STRIPE" as const,
      refundReason: "Customer accidentally purchased duplicate monthly subscription license",
      refundedAmount: 4900,
    },
    {
      companySlug: "nexus-tech",
      amount: 39900,
      status: "SUCCEEDED" as const,
      gateway: "STRIPE" as const,
      refundReason: null,
      refundedAmount: 0,
    },
    {
      companySlug: "lumina-creative",
      amount: 4900,
      status: "FAILED" as const,
      gateway: "SSLCOMMERZ" as const,
      refundReason: null,
      refundedAmount: 0,
    },
    {
      companySlug: "horizon-logistics",
      amount: 14900,
      status: "PARTIALLY_REFUNDED" as const,
      gateway: "BKASH" as const,
      refundReason: "Issued $50 goodwill discount credit due to mobile carrier network outage",
      refundedAmount: 5000,
    },
    {
      companySlug: "apex-financial",
      amount: 39900,
      status: "SUCCEEDED" as const,
      gateway: "STRIPE" as const,
      refundReason: null,
      refundedAmount: 0,
    },
  ];

  for (let i = 0; i < paymentVariations.length; i++) {
    const pv = paymentVariations[i];
    const comp = allCompanies.find((c) => c.slug === pv.companySlug) || allCompanies[i];
    if (!comp) continue;

    const txRef = `tx-demo-hist-${comp.slug}-${i}`;
    const idempKey = `idemp-hist-${comp.slug}-${i}`;

    await prisma.payment.upsert({
      where: { idempotencyKey: idempKey },
      update: {
        status: pv.status,
        refundReason: pv.refundReason,
        refundedAmount: pv.refundedAmount,
      },
      create: {
        companyId: comp.id,
        gateway: pv.gateway,
        amount: pv.amount,
        currency: "USD",
        status: pv.status,
        transactionRef: txRef,
        idempotencyKey: idempKey,
        refundReason: pv.refundReason,
        refundedAmount: pv.refundedAmount,
        createdAt: new Date(Date.now() - (i + 1) * 86400000 * 3),
      },
    });
  }

  // Invalidate all cache categories
  await invalidateCacheCategory("all");

  console.log("=== COMPREHENSIVE DUMMY DATA SEEDING COMPLETE! ===");
  console.log("All cache keys purged. Database is primed with realistic enterprise records.");
  process.exit(0);
}

seedComprehensiveData()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
