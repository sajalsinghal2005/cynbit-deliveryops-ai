import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.guard.js";

/**
 * Read-only DeliveryOps Projects API routes
 * Serves authoritative project delivery data, milestones, and blockers.
 */
export async function projectRoutes(app: FastifyInstance) {
  // GET /api/projects - List all delivery projects with customer, milestones, and blockers
  app.get(
    "/api/projects",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const query = request.query as { status?: string; search?: string };
        const where: any = {};

        if (query.status && query.status !== "all") {
          where.status = query.status;
        }

        if (query.search && query.search.trim()) {
          const s = query.search.trim();
          where.OR = [
            { id: { contains: s, mode: "insensitive" } },
            { name: { contains: s, mode: "insensitive" } },
            { deliveryLead: { contains: s, mode: "insensitive" } },
            { customer: { company: { contains: s, mode: "insensitive" } } },
          ];
        }

        const projects = await prisma.project.findMany({
          where,
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                company: true,
                email: true,
                status: true,
                aiHealthScore: true,
              },
            },
            milestones: {
              orderBy: { dueDate: "asc" },
            },
            blockers: {
              orderBy: { severity: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        const formatted = projects.map((p) => {
          const totalMilestones = p.milestones.length;
          const completedMilestones = p.milestones.filter((m) => m.status === "completed").length;
          const delayedMilestones = p.milestones.filter((m) => m.status === "delayed").length;
          const openBlockers = p.blockers.filter((b) => b.status === "open" || b.status === "in_progress");
          const criticalBlockers = openBlockers.filter((b) => b.severity === "CRITICAL").length;
          const highBlockers = openBlockers.filter((b) => b.severity === "HIGH").length;

          const progressPercent = totalMilestones > 0
            ? Math.round(p.milestones.reduce((acc, m) => acc + m.progressPercent, 0) / totalMilestones)
            : 0;

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            status: p.status,
            healthScore: p.healthScore,
            deliveryLead: p.deliveryLead,
            techStack: p.techStack,
            budget: p.budget,
            startDate: p.startDate,
            targetDate: p.targetDate,
            customer: p.customer,
            progressPercent,
            milestonesCount: totalMilestones,
            completedMilestonesCount: completedMilestones,
            delayedMilestonesCount: delayedMilestones,
            openBlockersCount: openBlockers.length,
            criticalBlockersCount: criticalBlockers,
            highBlockersCount: highBlockers,
            milestones: p.milestones,
            blockers: p.blockers,
          };
        });

        return reply.send({
          success: true,
          total: formatted.length,
          projects: formatted,
        });
      } catch (err: any) {
        request.log.error(err, "Failed to fetch projects");
        return reply.status(500).send({
          success: false,
          message: "Failed to retrieve projects.",
        });
      }
    }
  );

  // GET /api/projects/:id - Single project details
  app.get(
    "/api/projects/:id",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const project = await prisma.project.findFirst({
          where: {
            OR: [
              { id: { equals: id, mode: "insensitive" } },
              { name: { contains: id, mode: "insensitive" } },
            ],
          },
          include: {
            customer: true,
            milestones: {
              orderBy: { dueDate: "asc" },
            },
            blockers: {
              orderBy: { severity: "desc" },
            },
          },
        });

        if (!project) {
          return reply.status(404).send({
            success: false,
            message: `Project "${id}" not found.`,
          });
        }

        return reply.send({
          success: true,
          project,
        });
      } catch (err: any) {
        request.log.error(err, "Failed to fetch project by id");
        return reply.status(500).send({
          success: false,
          message: "Failed to retrieve project details.",
        });
      }
    }
  );
}
