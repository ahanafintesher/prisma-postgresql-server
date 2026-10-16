declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        roleSlug?: string;
        permissions?: string[];
      };
    }
  }
}

export {};