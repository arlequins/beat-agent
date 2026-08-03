export const ApiDeploymentPreset = {
  API_GATEWAY: "api-gateway",
  FUNCTION_URL: "function-url",
} as const;

export type ApiDeploymentPreset =
  (typeof ApiDeploymentPreset)[keyof typeof ApiDeploymentPreset];

export type ApiDeploymentInput = {
  customDomain?: string;
  preset?: ApiDeploymentPreset;
  throttleBurstLimit?: number;
  throttleRateLimit?: number;
  wafEnabled?: boolean;
};

export type ApiDeploymentConfig = {
  customDomain?: string;
  preset: ApiDeploymentPreset;
  throttleBurstLimit?: number;
  throttleRateLimit?: number;
  useEdgeRouter: boolean;
  wafEnabled: boolean;
};

const DEFAULT_THROTTLE_RATE_LIMIT = 100;
const DEFAULT_THROTTLE_BURST_LIMIT = 200;

/** Resolve deployment defaults and reject combinations unsupported by the selected AWS endpoint. */
export function resolveApiDeploymentConfig(
  input: ApiDeploymentInput,
): ApiDeploymentConfig {
  const preset = input.preset ?? ApiDeploymentPreset.FUNCTION_URL;
  const customDomain = input.customDomain?.trim() || undefined;
  const wafEnabled = input.wafEnabled ?? false;

  if (
    preset === ApiDeploymentPreset.FUNCTION_URL &&
    (input.throttleRateLimit !== undefined ||
      input.throttleBurstLimit !== undefined)
  ) {
    throw new Error(
      "API throttling limits require API_DEPLOYMENT_PRESET=api-gateway",
    );
  }

  if (preset === ApiDeploymentPreset.API_GATEWAY && wafEnabled) {
    throw new Error(
      "API_WAF_ENABLED is not supported by the API Gateway HTTP API preset; use the function-url edge preset or add a CloudFront edge layer",
    );
  }

  if (preset === ApiDeploymentPreset.API_GATEWAY) {
    return {
      customDomain,
      preset,
      throttleBurstLimit:
        input.throttleBurstLimit ?? DEFAULT_THROTTLE_BURST_LIMIT,
      throttleRateLimit: input.throttleRateLimit ?? DEFAULT_THROTTLE_RATE_LIMIT,
      useEdgeRouter: false,
      wafEnabled,
    };
  }

  return {
    customDomain,
    preset,
    useEdgeRouter: Boolean(customDomain) || wafEnabled,
    wafEnabled,
  };
}
