import type { SafeUserProfile } from "../services/auth.service.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: SafeUserProfile;
  }
}
