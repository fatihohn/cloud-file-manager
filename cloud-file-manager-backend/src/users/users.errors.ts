export const USER_ERRORS = {
  INVALID_ACCESS: {
    code: 'INVALID_ACCESS_REQUEST',
    message: 'Invalid access request',
  },
  EMAIL_IN_USE: {
    code: 'EMAIL_IN_USE',
    message: 'Email already in use',
  },
  CREATE_FAILED: {
    code: 'USER_CREATE_FAILED',
    message: 'Error creating user',
  },
  NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: (id?: string) =>
      id ? `Cannot find user with ID ${id}.` : 'User not found',
  },
};

export const USER_RESPONSES = {
  USER_DELETED: (id: string) => ({
    code: 'USER_DELETED',
    message: `Deleted user with ID ${id}.`,
  }),
};
