export type FormState =
  | {
      ok?: boolean;
      message?: string;
      fieldErrors?: Record<string, string[] | undefined>;
      values?: Record<string, string>;
      /** Возможные дубли при создании лида: форму можно отправить повторно с подтверждением. */
      duplicates?: { kind: string; label: string; href: string }[];
    }
  | undefined;
