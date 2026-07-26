export type UploadRequest = {
  contentType: string;
  fileName: string;
  size: number;
};

export type UploadTarget = {
  expiresAt: Date;
  key: string;
  method: "PUT";
  url: string;
};

export type FileStoragePort = {
  createUploadTarget(input: UploadRequest): Promise<UploadTarget>;
};
