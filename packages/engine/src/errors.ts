export class ParamError extends Error {
  override name = 'ParamError';
}

export class ZoneDataError extends Error {
  override name = 'ZoneDataError';
  constructor(readonly problems: string[]) {
    super(`Invalid zone data:\n- ${problems.join('\n- ')}`);
  }
}

export interface InputIssue {
  field: string;
  code: string;
}

export class InputError extends Error {
  override name = 'InputError';
  constructor(readonly issues: InputIssue[]) {
    // Field names and codes only: never put raw income values in messages (UU PDP).
    super(`Invalid input: ${issues.map((i) => `${i.field}:${i.code}`).join(', ')}`);
  }
}
