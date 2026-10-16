import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { config } from "../config/env.js";
import { emailService } from "../integrations/email/email.service.js";

const webhookPayloadSchema = z.object({
  id: z.string().min(1, "Event ID is required"),
  type: z.enum([
    "email.sent",
    "email.delivered",
    "email.bounced",
    "email.complained",
    "email.opened",
    "email.clicked",
  ]),
  created_at: z.string().optional(),
  data: z.object({
    email_id: z.string().min(1, "Email ID is required"),
    to: z.array(z.string()).optional(),
    from: z.string().optional(),
    subject: z.string().optional(),
  }),
});

export async function webhookRoutes(app: FastifyInstance) {
  /**
   * POST /api/webhooks/email
   * Receives transactional delivery lifecycle events from external email providers.
   * Verifies signatures, validates event schemas, and enforces idempotency.
   */
  app.post("/api/webhooks/email", async (request, reply) => {
    const rawSignature =
      (request.headers["svix-signature"] as string) ||
      (request.headers["x-webhook-signature"] as string);

    const rawPayload = JSON.stringify(request.body);

    // 1. Signature Verification: strictly mandatory for email lifecycle webhooks
    if (!config.EMAIL_WEBHOOK_SECRET) {
      return reply.status(401).send({
        success: false,
        code: "UNAUTHORIZED",
        message: "Webhook signing secret is not configured on the server.",
        requestId: request.id,
      });
    }

    if (!rawSignature) {
      return reply.status(401).send({
        success: false,
        code: "UNAUTHORIZED",
        message: "Missing webhook signature header.",
        requestId: request.id,
      });
    }

    const isValid = emailService.verifyWebhookSignature(rawPayload, rawSignature);
    if (!isValid) {
      return reply.status(403).send({
        success: false,
        code: "FORBIDDEN",
        message: "Invalid webhook signature.",
        requestId: request.id,
      });
    }

    // 2. Schema Validation
    const parsed = webhookPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Malformed webhook payload format.",
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        requestId: request.id,
      });
    }

    const event = parsed.data;

    // 3. Persistent Idempotency Check: Avoid processing the exact same event ID twice
    const existingAudit = await prisma.auditEvent.findFirst({
      where: {
        eventType: "EMAIL_WEBHOOK_PROCESSED",
        payload: {
          path: ["webhookEventId"],
          equals: event.id,
        },
      },
    });

    if (existingAudit) {
      return reply.status(200).send({
        success: true,
        duplicate: true,
        message: `Webhook event "${event.id}" already processed.`,
        eventId: event.id,
      });
    }

    // 4. Record Audit Trail Event
    await prisma.auditEvent.create({
      data: {
        eventType: "EMAIL_WEBHOOK_PROCESSED",
        actor: "SYSTEM (Email Provider Webhook)",
        payload: {
          webhookEventId: event.id,
          deliveryEventType: event.type,
          externalEmailId: event.data.email_id,
          recipients: event.data.to,
          subject: event.data.subject,
          receivedAt: new Date().toISOString(),
        },
      },
    });

    return reply.status(200).send({
      success: true,
      processed: true,
      eventId: event.id,
      eventType: event.type,
      message: `Successfully processed ${event.type} event.`,
    });
  });
}
