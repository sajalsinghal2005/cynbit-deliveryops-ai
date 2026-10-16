import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { approvalService } from "../services/approval.service.js";
import { ApprovalStatusSchema } from "../data/approvals.js";

const listQuerySchema = z.object({
  status: ApprovalStatusSchema.optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1, "Approval ID is required"),
});

const decideBodySchema = z.object({
  reason: z.string().optional(),
});

export class ApprovalController {
  public async listApprovals(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = listQuerySchema.safeParse(request.query);
    const status = parseResult.success ? parseResult.data.status : undefined;

    const approvals = await approvalService.listApprovals(status);
    return reply.status(200).send({
      success: true,
      count: approvals.length,
      approvals,
    });
  }

  public async getApproval(request: FastifyRequest, reply: FastifyReply) {
    const parseParam = idParamSchema.safeParse(request.params);
    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: "Invalid approval ID provided.",
      });
    }

    const approval = await approvalService.getApproval(parseParam.data.id);
    if (!approval) {
      return reply.status(404).send({
        success: false,
        message: `Approval request "${parseParam.data.id}" was not found.`,
      });
    }

    return reply.status(200).send({
      success: true,
      approval,
    });
  }

  public async approve(request: FastifyRequest, reply: FastifyReply) {
    const parseParam = idParamSchema.safeParse(request.params);
    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: "Invalid approval ID provided.",
      });
    }

    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Authentication required to approve actions.",
      });
    }

    try {
      const result = await approvalService.approveApproval(
        parseParam.data.id,
        request.user,
      );
      return reply.status(200).send(result);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to approve request.";
      const isNotFound = msg.includes("was not found");
      return reply.status(isNotFound ? 404 : 400).send({
        success: false,
        message: msg,
      });
    }
  }

  public async reject(request: FastifyRequest, reply: FastifyReply) {
    const parseParam = idParamSchema.safeParse(request.params);
    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: "Invalid approval ID provided.",
      });
    }

    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Authentication required to reject actions.",
      });
    }

    const parseBody = decideBodySchema.safeParse(request.body || {});
    const reason = parseBody.success ? parseBody.data.reason : undefined;

    try {
      const result = await approvalService.rejectApproval(
        parseParam.data.id,
        request.user,
        reason,
      );
      return reply.status(200).send(result);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to reject request.";
      const isNotFound = msg.includes("was not found");
      return reply.status(isNotFound ? 404 : 400).send({
        success: false,
        message: msg,
      });
    }
  }
}

export const approvalController = new ApprovalController();
