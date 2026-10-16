import type {
  ToolDefinition,
  ToolExecutionResult,
  ToolExecutionContext,
  ToolCategory,
} from "./tool.types.js";
export type {
  ToolDefinition,
  ToolExecutionResult,
  ToolExecutionContext,
  ToolRisk,
  ToolOperationType,
  ToolCategory,
} from "./tool.types.js";

// Customer tools
import {
  customerSearchTool,
  customerSummaryTool,
  customerInvoiceHistoryTool,
  customerOutstandingBalanceTool,
  customersWithOutstandingTool,
} from "./customer.tool.js";

// Invoice tools
import {
  invoiceSearchTool,
  invoiceSummaryTool,
  overdueInvoicesTool,
  outstandingInvoicesTool,
  invoiceStatusSummaryTool,
} from "./invoice.tool.js";

// Business Intelligence tools
import {
  biOutstandingTotalTool,
  biOverdueSummaryTool,
  biTopOutstandingCustomersTool,
  biRevenueMetricsTool,
} from "./analytics.tool.js";

// Cynbit DeliveryOps tools
import {
  projectSearchTool,
  projectSummaryTool,
  projectRiskAnalysisTool,
  projectBlockersTool,
  clientDeliverySummaryTool,
} from "./delivery.tool.js";

// Consequential Operational tools
import { sendEmailTool } from "./email.tool.js";
import { prepareClientFollowupTool } from "./followup.tool.js";
import { metricsService } from "../services/metrics.service.js";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    // 1. Register Customer Tools (5 read-only tools)
    this.register(customerSearchTool);
    this.register(customerSummaryTool);
    this.register(customerInvoiceHistoryTool);
    this.register(customerOutstandingBalanceTool);
    this.register(customersWithOutstandingTool);

    // 2. Register Invoice Tools (5 read-only tools)
    this.register(invoiceSearchTool);
    this.register(invoiceSummaryTool);
    this.register(overdueInvoicesTool);
    this.register(outstandingInvoicesTool);
    this.register(invoiceStatusSummaryTool);

    // 3. Register Business Intelligence Tools (4 read-only tools)
    this.register(biOutstandingTotalTool);
    this.register(biOverdueSummaryTool);
    this.register(biTopOutstandingCustomersTool);
    this.register(biRevenueMetricsTool);

    // 4. Register Consequential Operational Tools (1 consequential tool)
    this.register(sendEmailTool);

    // 5. Register Cynbit DeliveryOps Tools (5 read-only tools)
    this.register(projectSearchTool);
    this.register(projectSummaryTool);
    this.register(projectRiskAnalysisTool);
    this.register(projectBlockersTool);
    this.register(clientDeliverySummaryTool);

    // 6. Register Consequential DeliveryOps Follow-up Tool
    this.register(prepareClientFollowupTool);
  }

  /**
   * Registers a validated, typed business tool in the registry.
   */
  public register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  /**
   * Checks whether a tool is registered in the allowlist.
   */
  public hasTool(id: string): boolean {
    return this.tools.has(id);
  }

  /**
   * Retrieves a tool definition by its unique identifier.
   */
  public getTool(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  /**
   * Returns a complete list of all registered business tools.
   */
  public listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Returns registered tools filtered by capability category.
   */
  public listToolsByCategory(category: ToolCategory): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.category === category,
    );
  }

  /**
   * Centralized, safe execution pipeline for registered tools.
   * Guarantees:
   * 1. Only registered tools can be invoked (rejects unknown tools safely).
   * 2. Strict Zod schema validation before execution.
   * 3. Complete exception isolation and database leak sanitization.
   * 4. Optional output validation where outputSchema is declared.
   * 5. Context pass-through for authenticated actor attribution.
   */
  public async executeTool<TInput = any, TOutput = any>(
    toolId: string,
    params: TInput,
    context?: ToolExecutionContext,
  ): Promise<ToolExecutionResult<TOutput>> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        success: false,
        toolId,
        error: `Tool "${toolId}" is not registered in the tool registry.`,
      };
    }

    // 1. Schema validation before execution
    const validation = tool.schema.safeParse(params);
    if (!validation.success) {
      const issueDetails = validation.error.issues
        .map((issue) => `${issue.path.join(".") || "parameter"}: ${issue.message}`)
        .join("; ");
      return {
        success: false,
        toolId,
        error: `Invalid arguments for tool "${toolId}": ${issueDetails}`,
      };
    }

    // 2. Safe execution with exception isolation
    try {
      const result = await tool.execute(validation.data, context);

      // Optional output schema validation if tool declared outputSchema
      if (tool.outputSchema) {
        const outputValidation = tool.outputSchema.safeParse(result);
        if (!outputValidation.success) {
          return {
            success: false,
            toolId,
            error: `Tool "${toolId}" returned data that failed output schema validation.`,
          };
        }
      }

      metricsService.recordToolExecution(toolId, true);
      return {
        success: true,
        toolId,
        data: result,
        metadata: {
          operationType: tool.operationType,
          requiresApproval: tool.requiresApproval,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      metricsService.recordToolExecution(toolId, false);
      // Prevent leaking raw database error stacks, SQL statements, or internal paths
      const rawMessage = error instanceof Error ? error.message : "";
      const isInternalLeak =
        /prisma|postgres|sql|select|insert|update|delete|table|column|connect|connection/i.test(
          rawMessage,
        );
      const safeErrorMessage = isInternalLeak
        ? "An unexpected database error occurred while executing the tool."
        : rawMessage || "Tool execution failed.";

      return {
        success: false,
        toolId,
        error: safeErrorMessage,
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
