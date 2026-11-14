import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { databaseTestsEnabled, localSupabaseConfiguration } from "./test-environment.cjs";

/**
 * Helpers for tests that run against a REAL, dedicated Supabase project (never production):
 * they create users, products and orders and then delete them again.
 *
 * Required env (see .env.test.example):
 *   TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY, TEST_SUPABASE_SECRET_KEY, ALLOW_DB_TESTS=true
 */
export const dbTestsEnabled = databaseTestsEnabled(process.env);

const options = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export const adminClient = (): SupabaseClient => {
  if (!databaseTestsEnabled(process.env)) throw new Error("Database tests are not enabled.");
  const { url, secretKey } = localSupabaseConfiguration(process.env);
  return createClient(url, secretKey, options);
};
export const anonClient = (): SupabaseClient => {
  if (!databaseTestsEnabled(process.env)) throw new Error("Database tests are not enabled.");
  const { url, publishableKey } = localSupabaseConfiguration(process.env);
  return createClient(url, publishableKey, options);
};

export type TestUser = { id: string; email: string; client: SupabaseClient };

const PASSWORD = "Test-Pass-12345";
const created = { users: [] as string[], products: [] as string[], categories: [] as string[] };

export async function createTestUser(label = "user"): Promise<TestUser> {
  const email = `db-test-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.users.push(data.user.id);

  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw new Error(`signIn failed: ${signIn.error.message}`);
  return { id: data.user.id, email, client };
}

export async function createCategory() {
  const slug = `db-test-${randomUUID().slice(0, 8)}`;
  const { data, error } = await adminClient()
    .from("categories")
    .insert({ name: "DB test category", slug })
    .select("id")
    .single();
  if (error) throw new Error(`createCategory failed: ${error.message}`);
  created.categories.push(data.id);
  return data.id as string;
}

export async function createProduct(
  categoryId: string,
  overrides: { price?: number; stock?: number; active?: boolean; currency?: string } = {},
) {
  const slug = `db-test-${randomUUID().slice(0, 8)}`;
  const { data, error } = await adminClient()
    .from("products")
    .insert({
      category_id: categoryId,
      name: `DB test product ${slug}`,
      slug,
      short_description: "test",
      price: overrides.price ?? 10,
      stock_quantity: overrides.stock ?? 5,
      is_active: overrides.active ?? true,
      currency: overrides.currency ?? "EUR",
    })
    .select("id")
    .single();
  if (error) throw new Error(`createProduct failed: ${error.message}`);
  created.products.push(data.id);
  return data.id as string;
}

export const stockOf = async (productId: string) => {
  const { data } = await adminClient().from("products").select("stock_quantity").eq("id", productId).single();
  return data!.stock_quantity as number;
};

export const shippingDetails = {
  p_customer_name: "Test Customer",
  p_customer_email: "customer@example.test",
  p_customer_phone: "+48 600 100 200",
  p_country: "Poland",
  p_city: "Warszawa",
  p_postal_code: "00-001",
  p_address: "Testowa 1",
  p_apartment: null,
  p_notes: null,
};

export async function placeOrder(user: TestUser) {
  return user.client.rpc("place_order", shippingDetails);
}

export async function cleanupTestData() {
  const admin = adminClient();
  if (created.users.length) {
    // Orders outlive users (user_id is set to null), so delete them explicitly first.
    await admin.from("orders").delete().in("user_id", created.users);
  }
  await admin.from("payment_events").delete().eq("provider", "test-provider");
  if (created.products.length) await admin.from("products").delete().in("id", created.products);
  if (created.categories.length) await admin.from("categories").delete().in("id", created.categories);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  created.users = [];
  created.products = [];
  created.categories = [];
}
