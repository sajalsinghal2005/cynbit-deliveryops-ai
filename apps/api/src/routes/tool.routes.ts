import type { FastifyInstance } from "fastify";
import { toolRegistry } from "../tools/tool.registry.js";
import { authenticate } from "../middleware/auth.guard.js";

export async function toolRoutes(app: FastifyInstance) {
  // Read-only metadata introspection of registered tools for authenticated users
  app.get(
    "/api/tools",
    {
      preHandler: [authenticate],
    },
    async (_request, reply) => {
      const tools = toolRegistry.listTools().map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        operationType: t.operationType,
        risk: t.risk,
        requiresApproval: t.requiresApproval,
      }));

      return reply.send({
        success: true,
        total: tools.length,
        tools,
      });
    },
  );
}
