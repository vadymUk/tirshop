// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AdminDataTable, ErrorState, LoadingSkeleton } from "@/components/admin/admin-ui";
import { ProductForm } from "@/components/admin/product-form";

const save = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/product-actions", () => ({ saveProduct: save }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("administrator interface states", () => {
  it("announces loading and provides a retry action after an error", () => {
    const reset = vi.fn();
    const { unmount } = render(<LoadingSkeleton />);
    expect(screen.getByRole("status", { name: "Завантаження" })).toBeTruthy();
    unmount();
    render(<ErrorState reset={reset} />);
    expect(screen.getByRole("alert").textContent).toContain("Не вдалося завантажити дані");
    fireEvent.click(screen.getByRole("button", { name: "Спробувати знову" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("shows an empty state instead of an empty results table", () => {
    render(<AdminDataTable columns={["Товар"]} rows={[]} />);
    expect(screen.getByRole("heading", { name: "Немає записів" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("prevents creating a product without a category", () => {
    render(<ProductForm categories={[]} />);
    expect((screen.getByRole("button", { name: "Зберегти товар" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Спочатку створіть категорію.")).toBeTruthy();
  });

  it("surfaces a failed product save instead of reporting success", async () => {
    let finish!: (result: { error: string }) => void;
    save.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<ProductForm categories={[{ id: "category-1", name: "Category" }]} />);
    fireEvent.change(screen.getByLabelText("Назва", { exact: true }), { target: { value: "Product" } });
    fireEvent.change(screen.getByLabelText("Slug", { exact: true }), { target: { value: "product" } });
    fireEvent.change(screen.getByLabelText("Категорія", { exact: true }), { target: { value: "category-1" } });
    fireEvent.change(screen.getByLabelText("Ціна", { exact: true }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Зберегти товар" }));
    const pending = await screen.findByRole("button", { name: "Збереження…" });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { finish({ error: "Не вдалося зберегти товар." }); });
    expect((await screen.findByRole("alert")).textContent).toContain("Не вдалося зберегти товар");
    expect(save).toHaveBeenCalledOnce();
  });
});
