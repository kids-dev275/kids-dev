import "fastify";

export interface SafeAdminUser {
  id: string;
  email: string;
}

export interface AdminSessionContext {
  id: string;
  rawToken: string;
}

declare module "fastify" {
  interface FastifyRequest {
    admin?: SafeAdminUser;
    adminSession?: AdminSessionContext;
  }
}
