import { vi } from "vitest";

export type RecordedCall = [method: string, args: unknown[]];

/**
 * A chainable, awaitable stand-in for a Supabase query builder. Every method call is
 * recorded and returns the builder; awaiting it resolves to `result`.
 */
export function createQueryBuilder(result: unknown = { data: [], error: null, count: 0 }) {
  const calls: RecordedCall[] = [];
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, property: string) {
        if (property === "then") {
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject);
        }
        if (property === "calls") return calls;
        return (...args: unknown[]) => {
          calls.push([property, args]);
          return builder;
        };
      },
    },
  );
  return builder as Record<string, (...args: unknown[]) => unknown> & { calls: RecordedCall[] };
}

export const callsOf = (builder: { calls: RecordedCall[] }, method: string) =>
  builder.calls.filter(([name]) => name === method).map(([, args]) => args);

/** Minimal Supabase client whose tables, RPCs and auth methods are scripted by each test. */
export function createFakeSupabase() {
  const tables = new Map<string, ReturnType<typeof createQueryBuilder>[]>();
  const rpcResults = new Map<string, unknown>();

  const client = {
    auth: {
      getUser: vi.fn(),
      getClaims: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn((table: string) => {
      const queue = tables.get(table);
      const next = queue?.shift();
      if (!next) throw new Error(`Unexpected query on table "${table}"`);
      return next;
    }),
    rpc: vi.fn(async (name: string) => {
      if (!rpcResults.has(name)) throw new Error(`Unexpected rpc "${name}"`);
      return rpcResults.get(name);
    }),
  };

  return {
    client,
    /** Queue the result for the next `from(table)` call; returns the builder for assertions. */
    queueTable(table: string, result: unknown) {
      const builder = createQueryBuilder(result);
      tables.set(table, [...(tables.get(table) ?? []), builder]);
      return builder;
    },
    setRpc(name: string, result: unknown) {
      rpcResults.set(name, result);
    },
    signedInAs(user: { id: string; email?: string } | null) {
      client.auth.getUser.mockResolvedValue({ data: { user }, error: null });
      client.auth.getClaims.mockResolvedValue({
        data: user ? { claims: { sub: user.id, email: user.email } } : null,
        error: null,
      });
    },
  };
}

export const USER_A = { id: "11111111-1111-4111-8111-111111111111", email: "a@example.test" };
export const USER_B = { id: "22222222-2222-4222-8222-222222222222", email: "b@example.test" };
export const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
