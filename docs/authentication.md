# Beat OIDC Authentication

Beat은 별도의 운영용 아이디·비밀번호 저장소를 만들지 않고 기존 Beat 프로젝트의
OIDC provider를 사용한다.

```text
Browser / installed PWA
  -> Authorization Code + PKCE S256
  -> Beat OIDC provider
  -> JWT access token
  -> Beat Agent API
  -> discovery + JWKS + issuer/audience validation
```

브라우저는 public client이며 client secret을 갖지 않는다. API는 access token의
서명, issuer, audience, 만료, 허용 알고리즘과 `sub`를 검증한다.

## 사용자 식별

서로 다른 issuer가 같은 `sub`를 발급할 수 있으므로 `sub`만 데이터 키로 쓰지
않는다. API는 검증된 다음 값을 SHA-256 기반 UUID로 변환한다.

```text
issuer + "|" + subject -> derived user UUID
```

원본 subject, 이메일과 이름은 S3 object key에 포함하지 않는다. 관리자 bootstrap
목록도 동일한 `issuer|subject` 형태다.

## Provider 등록

기존 Beat OIDC에 Authorization Code와 PKCE를 사용하는 SPA client를 등록한다.

로컬 redirect URI:

```text
http://localhost:3000/auth/callback/
http://localhost:3000/auth/logout-callback/
```

운영 환경에는 실제 HTTPS 도메인의 동일 경로만 등록한다. wildcard callback은
허용하지 않는다.

```dotenv
OIDC_ISSUER_URL=https://id.beat.example
OIDC_AUDIENCE=https://api.agent.beat.example
OIDC_ALLOWED_ALGORITHMS=RS256
AUTH_BOOTSTRAP_ADMIN_IDENTITIES=https://id.beat.example|approved-subject

NEXT_PUBLIC_OIDC_AUTHORITY=https://id.beat.example
NEXT_PUBLIC_OIDC_CLIENT_ID=beat-agent-web
NEXT_PUBLIC_OIDC_RESOURCE=https://api.agent.beat.example
NEXT_PUBLIC_OIDC_SCOPE=openid profile email offline_access
```

JWKS URI는 discovery 문서에서 찾는다. provider가 표준 discovery를 제공하지
않을 때만 `OIDC_JWKS_URI`를 명시한다.

## 브라우저 세션

사용자가 승인한 현재 제품 정책에 따라 OIDC user와 token은 `localStorage`에
보관한다. 설치된 PWA도 같은 세션을 사용한다.

이 선택은 XSS가 token 탈취로 이어질 수 있음을 의미한다.

- CSP를 유지한다.
- untrusted HTML을 직접 렌더링하지 않는다.
- 인증 callback, API 응답, 대화와 상담 내용을 service worker에 캐시하지 않는다.
- token과 authorization header를 로그에 기록하지 않는다.
- XSS 사고가 의심되면 Beat OIDC에서 해당 사용자의 session을 폐기한다.

refresh token의 회전, 재사용 탐지와 모든 기기 로그아웃은 Beat OIDC provider가
소유한다. Beat Agent는 refresh token 데이터베이스나 비밀번호 endpoint를
제공하지 않는다.

## 로컬과 E2E

`pnpm dev:local`은 개발 전용 `@arlequins/oidc-mock`을 실행한다. 임의의 사용자
이름과 비밀번호를 받지만 모든 계정과 signing key는 메모리에만 존재한다.
프로덕션에는 이 provider를 배포하지 않는다.

Playwright는 MinIO, OIDC mock, API와 웹을 함께 실행해 다음을 검증한다.

- PKCE 로그인과 JWT 검증
- browser/PWA 재시작 후 세션 유지
- 보호된 workspace API
- 로그아웃
- S3-primary readiness

## 권한

- `protectedProcedure`는 유효한 access token을 요구한다.
- workspace repository는 매 요청에서 derived user ID의 membership을 다시
  확인한다.
- owner만 멤버 변경, 기억 승인·삭제, 문서 삭제, 평가와 release 활성화를 할 수
  있다.
- provider claim을 애플리케이션 권한으로 직접 신뢰하지 않는다.
