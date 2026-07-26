import {
  ApiDeploymentPreset,
  resolveApiDeploymentConfig,
} from "@arlequins/env";
import { describe, expect, it } from "vitest";

describe("resolveApiDeploymentConfig", () => {
  it("uses a direct Function URL by default", () => {
    expect(resolveApiDeploymentConfig({})).toEqual({
      customDomain: undefined,
      preset: ApiDeploymentPreset.FUNCTION_URL,
      useEdgeRouter: false,
      wafEnabled: false,
    });
  });

  it("adds an edge router for a Function URL custom domain or WAF", () => {
    expect(
      resolveApiDeploymentConfig({
        customDomain: " api.beat.localhost ",
        wafEnabled: true,
      }),
    ).toMatchObject({
      customDomain: "api.beat.localhost",
      useEdgeRouter: true,
      wafEnabled: true,
    });
  });

  it("applies conservative API Gateway throttle defaults", () => {
    expect(
      resolveApiDeploymentConfig({
        preset: ApiDeploymentPreset.API_GATEWAY,
      }),
    ).toMatchObject({
      throttleBurstLimit: 200,
      throttleRateLimit: 100,
    });
  });

  it("rejects endpoint-specific options on an incompatible preset", () => {
    expect(() => resolveApiDeploymentConfig({ throttleRateLimit: 10 })).toThrow(
      "API_DEPLOYMENT_PRESET=api-gateway",
    );
    expect(() =>
      resolveApiDeploymentConfig({
        preset: ApiDeploymentPreset.API_GATEWAY,
        wafEnabled: true,
      }),
    ).toThrow("API_WAF_ENABLED is not supported");
  });
});
