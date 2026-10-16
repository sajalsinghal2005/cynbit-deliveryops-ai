import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { aiOrchestrator } from "../orchestrator/ai.orchestrator.js";

const agentRequestSchema = z.object({
  message: z
    .string({
      error: "Message must be a string",
    })
    .trim()
    .min(1, "Please enter a business request.")
    .max(2000, "Request message exceeds maximum limit of 2,000 characters."),
});

export class AgentController {
  public async handleAgentRequest(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const parseResult = agentRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      const errorMessage =
        parseResult.error.issues[0]?.message ||
        "Please enter a valid business request.";
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        outcome: "INVALID_REQUEST",
        message: errorMessage,
        approvalRequired: false,
        requestId: request.id,
      });
    }

    if (!request.user) {
      return reply.status(401).send({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication required to invoke business agent.",
        requestId: request.id,
      });
    }

    try {
      const result = await aiOrchestrator.execute(
        parseResult.data.message,
        request.user,
        { requestId: request.id },
      );
      return reply.status(200).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        outcome: "INTERNAL_FAILURE",
        message:
          "An unexpected server error occurred while processing your request.",
        approvalRequired: false,
        requestId: request.id,
      });
    }
  }
}

export const agentController = new AgentController();
