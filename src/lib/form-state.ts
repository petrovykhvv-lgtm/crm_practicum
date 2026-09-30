export type FormState =
  | {
      ok?: boolean;
      message?: string;
      fieldErrors?: Record<string, string[] | undefined>;
      values?: Record<string, string>;
    }
  | undefined;
