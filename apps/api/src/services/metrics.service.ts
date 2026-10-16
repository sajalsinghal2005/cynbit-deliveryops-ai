/**
 * Observability & Telemetry Metrics Service
 * Provides minimal, in-memory, safe operational telemetry for BizOps AI.
 * Captures request counts, error distributions, tool executions, and approval decisions.
 * Strictly avoids logging or storing sensitive customer, invoice, or user data.
 */

export interface OperationalMetrics {
  uptimeSeconds: number;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  http: {
    totalRequests: number;
    activeRequests: number;
    statusCodes: Record<string, number>;
    averageResponseTimeMs: number;
  };
  errors: {
    totalErrors: number;
    byCode: Record<string, number>;
  };
  tools: {
    totalExecutions: number;
    totalFailures: number;
    byToolId: Record<string, { executions: number; failures: number }>;
  };
  governance: {
    proposalsCreated: number;
    decisionsApproved: number;
    decisionsRejected: number;
  };
}

class MetricsService {
  private startTime: number = Date.now();
  private totalRequests: number = 0;
  private activeRequests: number = 0;
  private totalResponseTimeMs: number = 0;
  private statusCodes: Record<string, number> = {};
  private totalErrors: number = 0;
  private errorsByCode: Record<string, number> = {};
  private totalToolExecutions: number = 0;
  private totalToolFailures: number = 0;
  private toolMetrics: Record<string, { executions: number; failures: number }> = {};
  private proposalsCreated: number = 0;
  private decisionsApproved: number = 0;
  private decisionsRejected: number = 0;

  public recordRequestStart(): void {
    this.totalRequests++;
    this.activeRequests++;
  }

  public recordRequestEnd(statusCode: number, durationMs: number): void {
    if (this.activeRequests > 0) {
      this.activeRequests--;
    }
    this.totalResponseTimeMs += durationMs;

    const statusKey = `${Math.floor(statusCode / 100)}xx`;
    this.statusCodes[statusKey] = (this.statusCodes[statusKey] || 0) + 1;
    this.statusCodes[statusCode.toString()] = (this.statusCodes[statusCode.toString()] || 0) + 1;
  }

  public recordError(code: string = "INTERNAL_SERVER_ERROR"): void {
    this.totalErrors++;
    this.errorsByCode[code] = (this.errorsByCode[code] || 0) + 1;
  }

  public recordToolExecution(toolId: string, success: boolean): void {
    this.totalToolExecutions++;
    if (!this.toolMetrics[toolId]) {
      this.toolMetrics[toolId] = { executions: 0, failures: 0 };
    }
    this.toolMetrics[toolId].executions++;

    if (!success) {
      this.totalToolFailures++;
      this.toolMetrics[toolId].failures++;
    }
  }

  public recordProposalCreated(): void {
    this.proposalsCreated++;
  }

  public recordDecision(status: "APPROVED" | "REJECTED"): void {
    if (status === "APPROVED") {
      this.decisionsApproved++;
    } else if (status === "REJECTED") {
      this.decisionsRejected++;
    }
  }

  public getSnapshot(): OperationalMetrics {
    const mem = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const avgResponseTime =
      this.totalRequests > 0
        ? Math.round((this.totalResponseTimeMs / this.totalRequests) * 100) / 100
        : 0;

    return {
      uptimeSeconds,
      memoryUsageMb: {
        rss: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
        heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      },
      http: {
        totalRequests: this.totalRequests,
        activeRequests: this.activeRequests,
        statusCodes: { ...this.statusCodes },
        averageResponseTimeMs: avgResponseTime,
      },
      errors: {
        totalErrors: this.totalErrors,
        byCode: { ...this.errorsByCode },
      },
      tools: {
        totalExecutions: this.totalToolExecutions,
        totalFailures: this.totalToolFailures,
        byToolId: { ...this.toolMetrics },
      },
      governance: {
        proposalsCreated: this.proposalsCreated,
        decisionsApproved: this.decisionsApproved,
        decisionsRejected: this.decisionsRejected,
      },
    };
  }

  public reset(): void {
    this.startTime = Date.now();
    this.totalRequests = 0;
    this.activeRequests = 0;
    this.totalResponseTimeMs = 0;
    this.statusCodes = {};
    this.totalErrors = 0;
    this.errorsByCode = {};
    this.totalToolExecutions = 0;
    this.totalToolFailures = 0;
    this.toolMetrics = {};
    this.proposalsCreated = 0;
    this.decisionsApproved = 0;
    this.decisionsRejected = 0;
  }
}

export const metricsService = new MetricsService();
