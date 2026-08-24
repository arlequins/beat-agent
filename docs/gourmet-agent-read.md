# Beat Agent Gourmet draft lookup

Beat Agent exposes one read-only model tool, `gourmet.drafts.list`, when the
request has an authenticated OIDC access token. The tool forwards that token in
the `Authorization` header only to the fixed Beat Gourmet API origin:

`https://4kfwvp7y2qoprape5p2jr5qvra0ekgcl.lambda-url.ap-northeast-1.on.aws`

It calls `GET /api/gourmet/entries?status=draft` and returns only the record
identity, restaurant and menu names, rating, revisit intent, status, dates, and
`imageCount`. It never returns image bytes, API keys, token values, or internal
storage paths. The access token is request-scoped and is not logged, persisted,
or included in an assistant message.

The fixed origin is intentional. Do not replace it with a mutable environment
variable or a user-provided URL: doing so could forward the user's OIDC token
to an untrusted destination. The Beat API must continue to accept the same
issuer and `beat-agent` audience used by the Beat Agent production contract.

The tool is available only in authenticated request-scoped services. Background
workers and unauthenticated requests do not receive it. A typical verification
prompt is:

```text
최근 저장한 Gourmet draft를 조회하고 각 기록의 이미지 개수와
사진이 연결된 기록을 구분해서 보여줘.
```
