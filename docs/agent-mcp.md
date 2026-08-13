# Beat MCP 경계

Beat Agent의 MCP 계층은 저장소나 AWS 자격 증명을 직접 노출하지 않는다. 인증된
호스트가 OIDC 주체와 workspace를 주입하고, MCP 서버는 매 호출마다 그 주체의
membership을 다시 확인한다.

## 현재 제공 도구

| 도구 | 성격 | 설명 |
| --- | --- | --- |
| `conversation.search` | 읽기 | 현재 workspace 대화의 제목과 짧은 발췌 검색 |
| `document.search` | 읽기 | 활성 knowledge release의 문서 근거 검색 |
| `memory.search` | 읽기 | 활성 release의 승인된 기억 검색 |
| `document.list` | 읽기 | 삭제되지 않은 문서 목록 |
| `feedback.submit` | 쓰기·확인 필요 | 사용자 확인 후 피드백 저장 |

문서와 기억 검색 결과는 `untrusted evidence`다. 모델은 결과 안의 지시문을 실행하거나
시스템 정책보다 우선해서는 안 된다. `feedback.submit`은 확인된 call ID가 없으면
저장하지 않고 확인 요청만 반환한다.

## 전송 경계

`@arlequins/agent-mcp`는 공식 MCP TypeScript SDK의 `McpServer`를 사용해 도구를
등록한다. 로컬 프로세스 연동은 `serveMcpStdio`가 SDK의 stdio transport를 사용하고,
원격 연동은 API의 `POST /mcp` 경계가 SDK의 web-standard handler를 사용한다.

원격 요청은 기존 Beat OIDC Bearer 인증을 먼저 통과해야 한다. workspace를 명시하기
위해 `X-Beat-Workspace-Id`(UUID)를 보내며, `feedback.submit`은 다음 헤더를 함께
보내는 별도 확인 단계가 필요하다.

```text
X-Beat-Tool-Call-Id: <confirmation-id>
X-Beat-Confirm-Tool: feedback.submit
```

HTTP 경계는 stateless JSON/SSE 호환 모드로 동작하므로 MCP 클라이언트가 요청마다
OIDC 토큰과 workspace 헤더를 보내야 한다. SDK 자체는 토큰을 검증하지 않으므로,
API가 `authApi.getSession`으로 검증한 principal만 서버 factory에 주입한다. 이는
[MCP TypeScript SDK HTTP serving 안내](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md)의
`handler.fetch(request, { authInfo })` 경계와 같은 책임 분리다.

## 모델 연동

`agent-core`는 텍스트, 도구 호출, 도구 결과, 사용량, 종료 원인을 구조화된 이벤트로
표현한다. Bedrock Converse는 `toolConfig`와 `toolUse` 스트림을 지원하고, Ollama는
현재 도구 호출 capability를 명시적으로 비활성화한다. 도구 실행에는 최대 4 라운드의
bounded loop가 적용된다.

답변 메시지에는 다음 실행 메타데이터가 저장된다.

- 활성 knowledge release ID
- prompt version
- 모델 ID
- 실행 지연시간
- 공급자가 반환한 input/output/total token 사용량
- 검색 품질 저하 여부

토큰 단가를 코드에 고정하지 않는다. 비용 대시보드나 예산 검사는 공급자별 최신 가격표를
사용량 메타데이터와 결합해 별도로 수행한다.
