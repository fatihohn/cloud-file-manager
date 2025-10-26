export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid credentials',
  },
  REFRESH_TOKEN_MISSING: {
    code: 'REFRESH_TOKEN_MISSING',
    message: 'Invalid credentials: no refresh token',
  },
  REFRESH_TOKEN_MISMATCH: {
    code: 'REFRESH_TOKEN_MISMATCH',
    message: 'Invalid credentials: token mismatch',
  },
};

export const AUTH_RESPONSES = {
  LOGGED_OUT: {
    code: 'LOGGED_OUT',
    message: 'Logged out.',
  },
};
