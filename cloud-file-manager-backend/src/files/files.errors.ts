export const FILE_ERRORS = {
  NO_FILES: {
    code: 'NO_FILES',
    message: 'At least one file must be provided',
  },
  UPLOAD_TOO_LARGE: {
    code: 'UPLOAD_TOO_LARGE',
    message: (limit: number) => `File size exceeds limit of ${limit} bytes`,
  },
  UNSUPPORTED_FILE_TYPE: {
    code: 'UNSUPPORTED_FILE_TYPE',
    message: 'Only CSV uploads are supported at this time',
  },
  BUFFER_MISSING: {
    code: 'BUFFER_MISSING',
    message: 'File buffer not available; ensure memory storage is configured',
  },
  FILE_PATH_MISSING: {
    code: 'FILE_PATH_MISSING',
    message: 'File path not available for upload',
  },
  S3_UPLOAD_FAILED: {
    code: 'S3_UPLOAD_FAILED',
    message: 'Failed to upload file to storage',
  },
  FILE_METADATA_SAVE_FAILED: {
    code: 'FILE_METADATA_SAVE_FAILED',
    message: 'Failed to save file metadata',
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'Owner not found or already deleted',
  },
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    message: 'File not found',
  },
  FORBIDDEN_RESOURCE: {
    code: 'FORBIDDEN_RESOURCE',
    message: 'You do not have access to this file',
  },
};

export const FILE_RESPONSES = {
  FILE_SOFT_DELETED: {
    code: 'FILE_SOFT_DELETED',
    message: 'File has been soft deleted',
  },
};
