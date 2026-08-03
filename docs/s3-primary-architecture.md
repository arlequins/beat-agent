# Beat S3-primary 아키텍처

## 결정

Beat의 프로덕션 source of truth는 PostgreSQL이 아니라 S3다. S3를 관계형
데이터베이스처럼 흉내 내지 않고 다음 세 종류의 객체로 역할을 나눈다.

1. `events/`: 절대 덮어쓰지 않는 변경 원본
2. `state/`: API 목록과 상세 조회를 위한 엔터티별 읽기 모델
3. `releases/`: 검토와 평가를 통과한 기억·지식 snapshot

`heads/` 객체만 활성 작업과 활성 릴리스를 가리키는 작은 가변 포인터다. 모든
가변 객체는 S3 Versioning과 ETag `If-Match`로 보호한다.

## 키 구조

```text
identities/{derivedUserId}/workspaces/{workspaceId}.json
identities/{derivedUserId}/heads/active-job.json

workspaces/{workspaceId}/workspace.json
workspaces/{workspaceId}/events/{epochMillis}-{eventId}.json
workspaces/{workspaceId}/state/members/{userId}.json
workspaces/{workspaceId}/state/conversations/{conversationId}.json
workspaces/{workspaceId}/state/messages/{conversationId}/{messageId}.json
workspaces/{workspaceId}/state/documents/{documentId}.json
workspaces/{workspaceId}/state/chunks/{documentId}/{chunkId}.json
workspaces/{workspaceId}/state/citations/{messageId}/{ordinal}-{chunkId}.json
workspaces/{workspaceId}/state/memories/{memoryId}.json
workspaces/{workspaceId}/state/feedback/{feedbackId}.json
workspaces/{workspaceId}/state/investigations/{investigationId}.json
workspaces/{workspaceId}/state/evaluation-cases/{caseId}.json
workspaces/{workspaceId}/state/evaluation-runs/{runId}.json

workspaces/{workspaceId}/blobs/sha256/{contentHash}.json
workspaces/{workspaceId}/releases/{releaseId}/snapshot.json
workspaces/{workspaceId}/releases/{releaseId}/manifest.json
workspaces/{workspaceId}/heads/active-release.json
```

## 쓰기 규칙

- 새 객체는 `If-None-Match: *`로만 생성한다.
- 기존 읽기 모델과 head는 마지막 ETag를 사용한 `If-Match`로만 교체한다.
- 충돌하면 최신 객체를 다시 읽고 최대 5회 재시도한다.
- 이벤트는 UUID가 포함된 새 키에 한 번만 기록한다.
- 물리 삭제 대신 `deletedAt` tombstone을 기록한다.
- 런타임 역할에는 `DeleteObjectVersion`을 허용하지 않는다.

S3는 여러 객체를 묶는 트랜잭션을 제공하지 않는다. 현재 구현은 먼저 엔터티
읽기 모델을 조건부 갱신하고 감사 이벤트를 기록한다. 이벤트 기록 실패는 요청
실패로 처리하며, 운영 복구 도구는 state와 event의 차이를 검사해야 한다.

## 동시 작업

`identities/{userId}/heads/active-job.json`은 사용자별 lease다.

- 첫 요청은 조건부 생성 또는 만료된 lease의 조건부 교체로 획득한다.
- 실행 중인 lease가 있으면 API는 `409 Agent Busy`를 반환한다.
- 응답에는 `estimatedCompletionAt`이 포함된다.
- lease에는 만료 시간이 있어 Lambda 중단 후에도 자동 복구된다.
- 정상·오류 종료 모두 `finally`에서 idle 상태로 교체한다.

채팅은 낮은 지연시간을 위해 Lambda 응답 스트림에서 직접 처리한다. 문서 색인,
조사와 주기적 평가처럼 긴 작업은 사용자 ID를 message group으로 사용하는 SQS
FIFO에서 처리한다. 모든 worker는 재실행을 전제로 멱등해야 한다.

## 검토된 릴리스

활성 릴리스는 다음 순서로만 바뀐다.

1. 승인된 기억과 유효한 문서 청크를 읽는다.
2. 최근 완료된 평가가 최소 Citation recall을 충족하는지 검사한다.
3. 새 `releaseId` 아래 snapshot을 조건부 생성한다.
4. snapshot SHA-256, 평가 run ID와 schema version을 manifest에 기록한다.
5. 두 객체가 모두 저장된 후 active head를 ETag 조건부 교체한다.

새 데이터 업로드 중에는 active head가 바뀌지 않으므로 질문은 이전 릴리스를
계속 본다. Citation은 메시지 생성 당시 active `releaseId`와 함께 저장된다.

## 보존과 비용

- 고유 이벤트와 release 객체는 덮어쓰지 않으므로 noncurrent version을 만들지
  않는다.
- state/head 객체의 과거 버전은 최소 3개를 남기고 90일 뒤 만료한다.
- incomplete multipart upload는 7일 후 정리한다.
- 대화·상담 전체에는 Object Lock을 적용하지 않는다.
- 감사 이벤트와 release manifest의 별도 Governance Lock은 보존 기간을 검토한
  뒤 추가할 수 있다.
- SSE-S3가 비용 없는 기본값이다. 고객 관리 KMS가 필요하면 S3 Bucket Key와
  함께 별도 opt-in으로 추가한다.

## 복구

1. active release manifest와 snapshot checksum을 검증한다.
2. 손상된 head는 정상 release의 key를 가리키는 새 버전으로 조건부 교체한다.
3. 읽기 모델 손상 시 workspace event와 immutable entity 객체를 사용해 다시
   생성한다.
4. S3 Versioning의 과거 state/head 버전을 복사해 현재 버전으로 복원한다.
5. 복구 후 평가를 다시 실행하기 전에는 새 release를 활성화하지 않는다.

같은 계정·버킷의 Versioning은 독립 백업이 아니다. 요구 복구 시간이 짧아지면
별도 백업 버킷 또는 교차 리전 복제를 비용 검토 후 추가한다.
