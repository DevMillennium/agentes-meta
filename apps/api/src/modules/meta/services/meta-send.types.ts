export type MetaSendMode = "graph" | "placeholder";

export type MetaSendResult =
  | {
      ok: true;
      mode: MetaSendMode;
      graphMessageId?: string;
      provider: string;
      raw?: unknown;
      note?: string;
    }
  | {
      ok: false;
      mode: "graph";
      provider: string;
      error: string;
      status?: number;
      meta?: unknown;
    };
