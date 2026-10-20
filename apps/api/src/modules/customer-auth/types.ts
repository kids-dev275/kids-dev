import "fastify";

export interface SafeCustomer {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
}

export interface CustomerSessionContext {
  id: string;
  rawToken: string;
}

declare module "fastify" {
  interface FastifyRequest {
    customer?: SafeCustomer;
    customerSession?: CustomerSessionContext;
  }
}
