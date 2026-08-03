# Beat

Beat은 Arlequin을 위한 개인 비서입니다. 대화와 상담 기록, 검토된 장기 기억,
개인 문서를 바탕으로 한국어로 답하고 문서 근거를 인용합니다. 의료·정신건강
진단이나 전문 치료를 대체하지 않습니다.

`template-agent` v0.3.0에서 제품화했지만 저장 구조는 의도적으로 다릅니다.
템플릿의 PostgreSQL 구현은 원본 저장소에 유지하고, Beat은 S3를 주 저장소로
사용합니다.

## 핵심 구조

- 기존 Beat OIDC의 Authorization Code + PKCE 로그인을 사용합니다.
- OIDC `(issuer, subject)`에서 충돌하지 않는 내부 UUID를 결정적으로 생성합니다.
- 대화, 기억, 문서, Citation, 피드백과 평가는 S3에 저장합니다.
- 변경할 수 있는 읽기 모델은 ETag 조건부 쓰기로 갱신합니다.
- 모든 변경은 별도의 append-only 이벤트로도 기록합니다.
- 삭제는 기본적으로 tombstone이며 런타임이 과거 버전을 지우지 않습니다.
- 승인된 기억과 문서는 평가를 통과한 버전별 릴리스로만 활성화됩니다.
- Citation은 답변 당시의 `knowledgeReleaseId`를 보존합니다.
- 같은 사용자의 두 번째 채팅 요청은 `409 Agent Busy`와 예상 완료 시각을
  반환합니다.

자세한 설계와 복구 절차는
[S3-primary 아키텍처](./docs/s3-primary-architecture.md)를 참고하세요.

## 로컬 실행

필요한 도구:

- `package.json`에 지정된 Node.js와 pnpm
- Docker
- 네이티브 Ollama 또는 Docker Ollama

```bash
pnpm install
pnpm agent:setup
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
pnpm dev:local
```

`pnpm dev:local`은 로컬 S3 호환 저장소인 MinIO를 시작하고 Beat OIDC mock,
API와 웹을 실행합니다.

- Web: `http://localhost:3000`
- API: `http://localhost:5000`
- Readiness: `http://localhost:5000/health/ready`
- MinIO console: `http://localhost:59001`

웹에서 **Beat 시작하기**를 누르고 OIDC mock에 임의의 사용자 이름과 비밀번호를
입력합니다. 첫 워크스페이스와 대화를 만든 뒤 질문할 수 있습니다.

로컬 Ollama는 loopback 주소만 허용합니다. 임베딩 모델을 사용할 수 없으면
워크스페이스 범위의 키워드 검색으로 안전하게 대체됩니다.

## AWS 프로덕션

API SST 스택은 다음을 생성합니다.

- 버전 관리와 공개 차단이 적용된 private S3 데이터 버킷
- TLS 및 조건부 쓰기를 강제하는 버킷 정책
- 오래된 읽기 모델 버전 비용을 제한하는 Lifecycle
- 장기 작업을 직렬화할 SQS FIFO와 DLQ
- S3 prefix와 선택된 Bedrock 모델에 한정된 Lambda 권한
- 오류, 지연시간, 요청량 대시보드와 알람

Bedrock은 명시적 opt-in입니다. 활성화하려면 정확한 모델 ID와 런타임에 허용할
ARN을 함께 지정합니다.

```dotenv
BEDROCK_MODEL_ID=replace-with-approved-model-id
BEDROCK_MODEL_ARN=arn:aws:bedrock:ap-northeast-1::foundation-model/replace-me
```

모델을 지정하지 않으면 AWS 배포에서 모델 호출 권한도 생성하지 않습니다.
Aurora, RDS, NAT Gateway, ECS와 상시 실행 컨테이너는 필요하지 않습니다.

## 데이터 릴리스

새 기억이나 문서를 승인해도 활성 릴리스에는 즉시 섞이지 않습니다.

1. 원본 이벤트와 후보 데이터를 축적합니다.
2. 승인된 평가 사례로 Retrieval 평가를 실행합니다.
3. Citation recall이 기본 기준 `0.75` 이상인지 확인합니다.
4. `agent.publishRelease`로 불변 snapshot과 checksum manifest를 생성합니다.
5. 모든 객체 생성이 성공한 뒤 `active-release.json`을 조건부 교체합니다.

활성화가 끝나기 전까지 질문은 이전 릴리스를 계속 사용합니다. 새 릴리스 이후
과거 답변의 Citation도 당시 릴리스 ID를 유지합니다.

## 검증

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:sst
pnpm test:e2e
```

Playwright E2E는 격리된 MinIO 버킷, OIDC mock, API와 웹을 실행하고 종료할 때
테스트 볼륨을 제거합니다.

## 주요 명령

| 명령 | 용도 |
| --- | --- |
| `pnpm dev:local` | MinIO, OIDC mock, API와 웹 실행 |
| `pnpm storage:start` | 로컬 MinIO와 Beat 버킷 준비 |
| `pnpm storage:stop` | 로컬 서비스 중지, 볼륨 보존 |
| `pnpm agent:demo:check` | Ollama chat/embedding 모델 확인 |
| `pnpm test:coverage` | 75% 전체 커버리지 기준 검증 |
| `pnpm test:e2e` | 실제 브라우저와 격리된 S3 호환 저장소 검증 |

## 보안 경계

- 브라우저는 S3 자격 증명을 받지 않습니다.
- API는 OIDC access token을 검증한 뒤 워크스페이스 멤버십을 다시 확인합니다.
- S3 객체 키에는 원본 OIDC subject나 이메일을 넣지 않습니다.
- 상담과 문서 본문을 애플리케이션 로그에 기록하지 않습니다.
- 배포 역할과 Lambda 런타임 역할은 분리합니다.
- 전체 상담 버킷에는 Object Lock을 기본 적용하지 않습니다. 삭제 대응이 필요한
  민감정보와 WORM 보존 요구가 충돌할 수 있기 때문입니다.
- 감사·릴리스 manifest의 별도 Governance Object Lock은 후속 opt-in으로 둡니다.

GitHub Actions 배포 순서와 필요한 Environment secret은
[CI/CD 운영](./docs/ci-cd.md)을 참고하세요.
