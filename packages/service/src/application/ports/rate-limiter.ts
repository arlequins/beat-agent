export type RateLimitRequest = {
  key: string;
  limit: number;
  now: Date;
  windowMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
};

export type RateLimitPort = {
  consume(input: RateLimitRequest): Promise<RateLimitDecision>;
};
