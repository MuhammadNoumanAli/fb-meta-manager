export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

interface RequestLike {
  ip?: string;
  headers: Record<string, unknown>;
}

export const getRequestContext = (request: RequestLike): RequestContext => {
  const forwarded = request.headers['x-forwarded-for'];
  const forwardedIp = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined;
  const userAgent = request.headers['user-agent'];

  return {
    ipAddress: forwardedIp ?? request.ip ?? null,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 255) : null,
  };
};
