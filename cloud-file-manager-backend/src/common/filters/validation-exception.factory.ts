import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

interface ValidationErrorPayload {
  field: string;
  reason: string;
  message: string;
}

const toReason = (constraintKey: string): string =>
  constraintKey
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();

const flattenValidationErrors = (
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorPayload[] =>
  errors.flatMap((error) => {
    const fieldPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const constraintEntries = Object.entries(error.constraints ?? {});

    const currentLevel = constraintEntries.map<ValidationErrorPayload>(
      ([constraintKey, message]) => ({
        field: fieldPath,
        reason: toReason(constraintKey),
        message,
      }),
    );

    if (error.children && error.children.length > 0) {
      return [
        ...currentLevel,
        ...flattenValidationErrors(error.children, fieldPath),
      ];
    }

    return currentLevel;
  });

export const validationExceptionFactory = (errors: ValidationError[]) => {
  const formatted = flattenValidationErrors(errors);

  return new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed',
    errors: formatted,
  });
};
