import { expect, test, vi } from "vitest";
import { logoutWorkspace } from "../lib/logout";

test("demo exits to login without making an authentication request", async () => {
  const signOut = vi.fn();
  const redirect = vi.fn();
  await logoutWorkspace(false, signOut, redirect);
  expect(signOut).not.toHaveBeenCalled();
  expect(redirect).toHaveBeenCalledWith("/login");
});

test("authenticated logout waits for session revocation before navigation", async () => {
  const redirect = vi.fn();
  let finish!: (value: { error?: unknown }) => void;
  const signOut = vi.fn(
    () =>
      new Promise<{ error?: unknown }>((resolve) => {
        finish = resolve;
      }),
  );
  const logout = logoutWorkspace(true, signOut, redirect);
  expect(redirect).not.toHaveBeenCalled();
  finish({});
  await logout;
  expect(signOut).toHaveBeenCalledOnce();
  expect(redirect).toHaveBeenCalledWith("/login");
});

test.each(["response", "network"])(
  "failed %s logout does not claim success",
  async (failure) => {
    const signOut =
      failure === "response"
        ? vi.fn().mockResolvedValue({ error: { message: "Unavailable" } })
        : vi.fn().mockRejectedValue(new Error("Network failed"));
    const redirect = vi.fn();
    await expect(logoutWorkspace(true, signOut, redirect)).rejects.toThrow();
    expect(redirect).not.toHaveBeenCalled();
  },
);
