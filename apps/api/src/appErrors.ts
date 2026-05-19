export type AppErrorResponse = {
  body: {
    error: string;
  };
  status: 403 | 500;
};

export class MissingAccessProfileError extends Error {
  constructor() {
    super("access_profile_not_found");
  }
}

export function resolveAppErrorResponse(error: unknown): AppErrorResponse {
  if (error instanceof MissingAccessProfileError) {
    return {
      body: { error: "access_profile_not_found" },
      status: 403
    };
  }

  return {
    body: { error: "internal_error" },
    status: 500
  };
}
