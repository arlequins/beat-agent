# Beat Agent Platform

Beat은 Arlequin 한 사람을 위한 개인 비서이자 반성적 대화 파트너다. 의료 또는
정신건강 진단을 하지 않으며 전문 치료와 긴급 지원을 대체하지 않는다.

## Runtime 경계

`@arlequins/agent-core`는 provider-neutral loop만 담당한다.

```text
question
  -> workspace-scoped approved memory
  -> active knowledge release
  -> Ollama or Bedrock model
  -> streaming text and citations
```

Core에는 AWS SDK, HTTP, UI와 저장 구현이 없다. Beat composition root가 다음
adapter를 선택한다.

| Port | 로컬 | AWS |
| --- | --- | --- |
| 모델 | loopback Ollama | production Amazon Nova Lite Converse Stream |
| 주 저장소 | Docker MinIO | private versioned S3 |
| 기억·지식 검색 | S3 객체의 embedding/keyword | 활성 S3 release, 이후 선택적 S3 Vectors |
| 긴 작업 | 직접 실행 | SQS FIFO + Lambda worker |
| 인증 | OIDC mock | 기존 Beat OIDC |

## 저장과 권한

대화, 메시지, 문서와 청크, Citation, 기억, 피드백, 조사, 평가를 workspace
prefix 아래 저장한다. 모든 repository 호출은 먼저 membership을 확인한다.

- 새 엔터티와 이벤트는 `If-None-Match: *`
- 상태 변경과 head 이동은 ETag `If-Match`
- 삭제는 tombstone
- 운영 변경은 append-only audit event
- Citation은 active knowledge release ID 고정

구체적인 key 구조, 동시성, release와 복구는
[S3-primary 아키텍처](./s3-primary-architecture.md)에 정의한다.

## 기억과 상담

원본 대화와 상담 기록은 사용자가 요청한 장기 기억 정책에 따라 저장한다.
답변 context에는 승인되고 만료되지 않은 기억만 들어간다.

기억의 상태:

```text
candidate -> approved
          -> rejected
```

원본 보존과 모델 학습 사용은 별도 결정이다. `approved` 기억도 평가된 release를
활성화하기 전까지 현재 답변에는 영향을 주지 않는다.

## 문서와 Citation

텍스트, Markdown과 HTML은 서버에서 정규화한 뒤 최대 1,200자 청크로 나눈다.
로컬 `nomic-embed-text`를 사용할 수 있으면 embedding cosine score를 사용하고,
그렇지 않으면 keyword score로 대체한다.

PDF와 Office 문서는 추후 malware scan과 서버 parser를 거치는 별도 비동기
ingestion으로 추가한다. 브라우저가 binary 문서를 해석하지 않는다.

답변 Citation은 다음을 보존한다.

- message ID
- document ID
- chunk ID와 ordinal
- filename과 locator
- knowledge release ID

문서를 tombstone 처리하면 새 검색과 Citation 조회에서 제외되지만 과거 event와
S3 version은 retention 정책에 따라 유지된다.

## 피드백과 reviewed learning

지원하는 피드백:

- `helpful`
- `incorrect`
- `missing`
- `needs-investigation`

`needs-investigation`은 조사 작업을 생성한다. 피드백과 조사는 자동으로 모델이나
활성 지식을 바꾸지 않는다.

```text
feedback
  -> evidence collection
  -> reviewed evaluation case
  -> retrieval evaluation
  -> immutable snapshot + checksum manifest
  -> conditional active-release switch
```

기본 release gate는 Citation recall `0.75`다.

## 동시 실행

사용자별 active-job lease로 채팅을 한 번에 하나만 처리한다. 두 번째 요청에는
HTTP `409`, job ID와 예상 완료 시각을 반환한다. Lambda 중단으로 lease가 남아도
만료 후 새 요청이 조건부로 회수할 수 있다.

문서 색인, 피드백 조사와 주기적 평가는 SQS FIFO에서 같은 사용자 message group
안에 직렬화한다. worker는 at-least-once 실행을 전제로 멱등해야 한다.

## 비용 정책

- S3, Lambda와 SQS를 기본 서버리스 구성으로 사용한다.
- RDS, Aurora, NAT Gateway, ECS와 항상 실행되는 서비스를 만들지 않는다.
- Production Bedrock은 `amazon.nova-lite-v1:0`과 정확한
  `ap-northeast-1` ARN을 protected Environment에서 받을 때만 활성화한다.
  Lambda 권한은 `bedrock:InvokeModelWithResponseStream` 하나로 제한한다.
- S3 Vectors와 별도 백업·복제는 데이터량과 복구 목표가 필요해질 때 opt-in한다.
- Budget과 Cost Anomaly alert는 모델 사용 전에 설정한다.
