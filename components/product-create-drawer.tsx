"use client";
import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import type { ConvexInventoryProvider } from "@/lib/providers/convex";
export function ProductCreateDrawer({
  open,
  onOpenChange,
  provider,
  onCreated,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: {
    createProduct(
      input: import("@/lib/catalogue-input").CatalogueInput,
      idempotencyKey: string,
    ): Promise<unknown>;
  };
  onCreated: () => void | Promise<void>;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [error, setError] = useState<string | null>(null),
    [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const text = (key: string) => String(data.get(key) || "").trim();
      const cost = Number(text("cost")) * 100,
        mrp = Number(text("mrp")) * 100;
      if (
        !Number.isSafeInteger(cost) ||
        !Number.isSafeInteger(mrp) ||
        cost < 0 ||
        mrp < 0
      )
        throw new Error("Enter valid cost and suggested MRP in rupees.");
      await provider.createProduct(
        {
          sku: text("sku"),
          name: text("name"),
          category: text("category"),
          color: text("color"),
          fabric: text("fabric"),
          craft: text("craft"),
          kurtaLength: Number(text("kurtaLength")),
          style: text("style"),
          collection: "Operator catalogue",
          season: text("season"),
          launchDate: text("launchDate"),
          costMinor: cost,
          suggestedMrpMinor: mrp,
          sizes: data.getAll("sizes").map(String),
          images: text("image")
            ? [
                {
                  url: text("image"),
                  sourceProductUrl: text("source"),
                  alt: text("name"),
                  width: 600,
                  height: 800,
                },
              ]
            : [],
        },
        crypto.randomUUID(),
      );
      await onCreated();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Product could not be saved.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="product-drawer"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogTitle>Add a dress or dupatta</DialogTitle>
        <DialogDescription>
          Create the style and sizes first. Receive stock separately through the
          stock API.
        </DialogDescription>
        <form onSubmit={submit} className="catalogue-form">
          {["sku", "name", "color", "fabric", "craft", "style", "season"].map(
            (key) => (
              <label key={key}>
                {
                  {
                    sku: "Product SKU",
                    name: "Product name",
                    color: "Colour",
                    fabric: "Fabric",
                    craft: "Craft",
                    style: "Style",
                    season: "Season",
                  }[key]
                }
                <input
                  name={key}
                  required
                  maxLength={key === "name" ? 250 : 100}
                />
              </label>
            ),
          )}
          <label>
            Category
            <select name="category">
              <option>Kurta sets</option>
              <option>Suit sets</option>
              <option>Dresses</option>
              <option>Dupattas</option>
            </select>
          </label>
          <div className="form-grid">
            <label>
              Cost · ₹
              <input name="cost" type="number" required min="0" step="0.01" />
            </label>
            <label>
              Suggested MRP · ₹
              <input name="mrp" type="number" required min="0" step="0.01" />
            </label>
            <label>
              Kurta length · inches
              <input
                name="kurtaLength"
                type="number"
                defaultValue="42"
                min="0"
                step="0.1"
              />
            </label>
            <label>
              Launch date
              <input
                name="launchDate"
                type="date"
                required
                defaultValue="2026-10-06"
              />
            </label>
          </div>
          <fieldset>
            <legend>Applicable sizes</legend>
            <div className="size-checkboxes">
              {["XS", "S", "M", "L", "XL", "XXL", "Free size"].map((size) => (
                <label key={size}>
                  <input type="checkbox" name="sizes" value={size} />
                  {size}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Image URL · optional
            <input
              name="image"
              type="url"
              placeholder="https://img.theloom.in/…"
            />
          </label>
          <label>
            Source product URL
            <input
              name="source"
              type="url"
              placeholder="https://theloom.in/…"
            />
          </label>
          {error && (
            <p role="alert" className="login-notice error">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Create product"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
