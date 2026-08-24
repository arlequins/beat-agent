# Bedrock production operations

Beat Agent production uses Amazon Nova Lite through the existing AWS SDK
`ConverseStreamCommand` adapter. The model is intentionally fixed to one
foundation model and Titan embeddings in `ap-northeast-1` for the first production rollout:

```dotenv
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_MODEL_ARN=arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.nova-lite-v1:0
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0
```

Nova Lite supports the current streaming path and Titan supports semantic
retrieval. The runtime grants `bedrock:InvokeModelWithResponseStream` only on
the Nova ARN and `bedrock:InvokeModel` only on the embedding model ARN. It does
not use wildcard model ARNs or a cross-region inference profile.

`beat-sst-aws` owns the account bootstrap and the protected GitHub OIDC role;
the Beat Agent application stack owns its Lambda functions and their runtime
Bedrock policies. Bedrock does not issue an application API key. The account
and region model-access state is checked before the protected deployment, and
the short-lived OIDC role is the only deployment credential path.

## Protected environment handoff

The full `DEPLOYMENT_ENV_FILE` remains a protected secret and must never be
overwritten. Configure the model and embedding identifiers as variables on
the protected `production` Environment instead:

1. Open **Settings → Environments → production → Environment variables**.
2. Set `BEDROCK_MODEL_ID` to `amazon.nova-lite-v1:0` and
   `BEDROCK_EMBEDDING_MODEL_ID` to `amazon.titan-embed-text-v2:0`.
3. Set `BEDROCK_MODEL_ARN` to
   `arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.nova-lite-v1:0`.
4. Preserve the existing `DEPLOYMENT_ENV_FILE` secret and never put any model
   value in a `NEXT_PUBLIC_*` variable.

The production workflow writes the complete dotenv secret first, then appends
these variables immediately before SST runs. It fails closed when any required
variable is missing, so a deployment cannot silently fall back to a disabled or
different model. The values are identifiers, not credentials; the full dotenv
payload remains protected because it also contains runtime configuration.

Immediately after OIDC credentials are configured, the workflow runs
`pnpm bedrock:verify`. This read-only check calls
`aws bedrock get-foundation-model` for both identifiers and verifies the exact
Tokyo ARNs and `ACTIVE` lifecycle status. It never prints credentials or model
content.

## Deployment and verification

Do not run AWS or SST commands locally. Use the trusted GitHub Actions flow:

1. Review the `beat-sst-aws` bootstrap/OIDC diff and the Agent application's
   [SST runtime policy](../apps/api/sst.config.ts) for the narrowly scoped
   streaming and embedding Bedrock permissions.
2. Approve the protected production API deployment in this repository. The
   deployment stops before SST changes if account access, region, model ID, or
   model ARN drifted.
3. Run the Google SSO production smoke after Beat's Google OAuth client is
   configured. The model response itself should be verified through the user
   session in the browser; no Google credentials are placed in GitHub Actions.
4. Confirm that the smoke response completes and that CloudWatch logs contain
   only request metadata, never prompts, completions, or the dotenv payload.

If the model smoke fails, stop promotion and inspect the protected workflow
logs and the scoped Lambda log group. Do not broaden IAM or print environment
values as a diagnostic shortcut. A rollback is the previous Beat Agent release
through the same protected workflow; leave the model ARN contract unchanged.

## Local and preview behavior

Local and preview stages may omit the Bedrock variables and use Ollama when configured.
The production SST configuration is fail-closed: missing, mismatched, or
non-Tokyo Nova Lite values stop before resource changes. The committed
`.env.example` contains commented examples only and never enables Bedrock.
