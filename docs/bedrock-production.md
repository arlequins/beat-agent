# Bedrock production operations

Beat Agent production uses Amazon Nova Lite through the existing AWS SDK
`ConverseStreamCommand` adapter. The model is intentionally fixed to one
foundation model in `ap-northeast-1` for the first production rollout:

```dotenv
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_MODEL_ARN=arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.nova-lite-v1:0
```

Nova Lite supports the current streaming path and leaves the runtime with one
least-privilege action: `bedrock:InvokeModelWithResponseStream` on the exact ARN
above. The API does not grant `bedrock:InvokeModel`, use a wildcard model ARN,
or use a cross-region inference profile for this rollout.

## Protected secret handoff

An operator with access to the repository's protected `production` Environment
must append the two lines above to the existing `DEPLOYMENT_ENV_FILE` secret in
`arlequins/beat-agent`:

1. Open **Settings → Environments → production → Environment secrets**.
2. Edit `DEPLOYMENT_ENV_FILE` and preserve its existing dotenv entries.
3. Add the exact `BEDROCK_MODEL_ID` and `BEDROCK_MODEL_ARN` entries once.
4. Do not paste the payload into chat, commit it, echo it in a workflow, or put
   either value in a `NEXT_PUBLIC_*` variable.

The values are not credentials, but the complete payload is protected because
it also contains runtime configuration. GitHub Actions writes this secret to
the runner with owner-only permissions, then SST passes only the model
configuration to the API Lambda.

## Deployment and verification

Do not run AWS or SST commands locally. Use the trusted GitHub Actions flow:

1. Review the infrastructure diff in `beat-sst-aws` for the single-model
   `InvokeModelWithResponseStream` permission.
2. Approve the protected production API deployment in this repository.
3. Run the authenticated production smoke with
   `expect_model=enabled`.
4. Confirm that the smoke response completes and that CloudWatch logs contain
   only request metadata, never prompts, completions, or the dotenv payload.

If the model smoke fails, stop promotion and inspect the protected workflow
logs and the scoped Lambda log group. Do not broaden IAM or print environment
values as a diagnostic shortcut. A rollback is the previous Beat Agent release
through the same protected workflow; leave the model ARN contract unchanged.

## Local and preview behavior

Local and preview stages may omit both variables and use Ollama when configured.
The production SST configuration is fail-closed: missing, mismatched, or
non-Tokyo Nova Lite values stop before resource changes. The committed
`.env.example` contains commented examples only and never enables Bedrock.
