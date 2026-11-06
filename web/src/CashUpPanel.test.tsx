import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { CashUpPanel } from "./CashUpPanel";
import type { CloseoutClient, CloseoutSnapshot } from "./contracts";

const snapshot: CloseoutSnapshot = {
  drawerId: "counter-01",
  currency: "EUR",
  openingCashMinor: 10000,
  transactions: [
    {
      id: "sale-001",
      kind: "sale",
      amountMinor: 5500,
      description: "Cash sale",
    },
    {
      id: "refund-001",
      kind: "refund",
      amountMinor: 750,
      description: "Cash refund",
    },
  ],
  expectedCashMinor: 14750,
  countedCashMinor: null,
  varianceMinor: null,
  explanation: "",
  status: "draft",
  finalizedAtUtc: null,
};

describe("CashUpPanel", () => {
  it("displays closeout transactions with their type and signed amount", async () => {
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(snapshot),
      saveDraft: vi.fn(),
      finalize: vi.fn(),
    };

    render(<CashUpPanel client={client} onFinalized={vi.fn()} />);

    const table = await screen.findByRole("table", { name: "Transactions" });
    expect(table).toHaveTextContent("Cash sale");
    expect(table).toHaveTextContent("Sale");
    expect(table).toHaveTextContent(
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "EUR",
      }).format(55),
    );
    expect(table).toHaveTextContent("Cash refund");
    expect(table).toHaveTextContent("Refund");
    expect(table).toHaveTextContent(
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "EUR",
      }).format(-7.5),
    );
  });

  it("shows cash-up values and calculates variance from the drawer count", async () => {
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(snapshot),
      saveDraft: vi.fn(),
      finalize: vi.fn(),
    };

    render(<CashUpPanel client={client} onFinalized={vi.fn()} />);

    expect(await screen.findByText("Opening Cash")).toBeInTheDocument();
    expect(
      screen.getByText(
        new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "EUR",
        }).format(100),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Expected Cash")).toBeInTheDocument();
    expect(
      screen.getByText(
        new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "EUR",
        }).format(147.5),
      ),
    ).toBeInTheDocument();

    const countInput = screen.getByRole("spinbutton", { name: "Drawer Count" });
    expect(screen.getByLabelText("Explanation")).toBeInTheDocument();
    expect(screen.getByText("--")).toBeInTheDocument();

    fireEvent.change(countInput, { target: { value: "150.25" } });
    fireEvent.change(countInput, { target: { value: "" } });
    expect(countInput).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.change(countInput, { target: { value: "150.25" } });

    const variance = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(2.75);
    expect(screen.getByText(variance)).toBeInTheDocument();
    expect(screen.getByText("Surplus")).toHaveClass("cash-up-variance-status");

    fireEvent.change(countInput, { target: { value: "140.00" } });
    const shortage = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(-7.5);
    expect(screen.getByText("Variance").parentElement).toHaveTextContent(shortage);
    expect(screen.getByText("Shortage")).toHaveClass(
      "cash-up-variance-status",
    );

    fireEvent.change(countInput, { target: { value: "147.50" } });
    expect(screen.queryByText("Surplus")).not.toBeInTheDocument();
    expect(screen.queryByText("Shortage")).not.toBeInTheDocument();
    expect(screen.getByText("Match")).toHaveClass(
      "cash-up-variance-status",
      "cash-up-variance-match",
    );
  });

  it("formats a valid drawer count to two decimals when it loses focus", async () => {
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(snapshot),
      saveDraft: vi.fn(),
      finalize: vi.fn(),
    };

    render(<CashUpPanel client={client} onFinalized={vi.fn()} />);

    const countInput = await screen.findByRole("spinbutton", {
      name: "Drawer Count",
    });
    fireEvent.change(countInput, { target: { value: "150.2" } });
    fireEvent.blur(countInput);

    expect(countInput).toHaveValue(150.2);
    expect(countInput).toHaveDisplayValue("150.20");
  });

  it("marks a cleared drawer count and a missing variance explanation as errors", async () => {
    const savedSnapshot: CloseoutSnapshot = {
      ...snapshot,
      countedCashMinor: 15025,
      varianceMinor: 275,
      explanation: "Recounted",
    };
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(savedSnapshot),
      saveDraft: vi.fn(),
      finalize: vi.fn(),
    };

    render(<CashUpPanel client={client} onFinalized={vi.fn()} />);

    const countInput = await screen.findByRole("spinbutton", {
      name: "Drawer Count",
    });
    const explanationInput = screen.getByLabelText("Explanation");

    fireEvent.change(countInput, { target: { value: "" } });
    expect(countInput).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(countInput, { target: { value: "150.25" } });
    expect(countInput).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.change(explanationInput, { target: { value: "" } });
    expect(explanationInput).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(explanationInput, { target: { value: "Recounted" } });
    expect(explanationInput).not.toHaveAttribute("aria-invalid", "true");
  });

  it("marks an explanation as not applicable for zero variance and clears it when reverted", async () => {
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(snapshot),
      saveDraft: vi.fn(),
      finalize: vi.fn(),
    };

    render(<CashUpPanel client={client} onFinalized={vi.fn()} />);

    const countInput = await screen.findByRole("spinbutton", {
      name: "Drawer Count",
    });
    const explanationInput = screen.getByLabelText("Explanation");

    fireEvent.change(countInput, { target: { value: "147.50" } });
    expect(explanationInput).not.toHaveAttribute("aria-invalid", "true");

    fireEvent.change(explanationInput, { target: { value: "Not needed" } });
    expect(explanationInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Not Applicable.")).toBeInTheDocument();

    fireEvent.change(explanationInput, { target: { value: "" } });
    expect(explanationInput).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Not Applicable.")).not.toBeInTheDocument();
  });

  it("shows a table skeleton and disables controls while reloading", async () => {
    const savedSnapshot: CloseoutSnapshot = {
      ...snapshot,
      countedCashMinor: snapshot.expectedCashMinor,
      varianceMinor: 0,
    };
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(savedSnapshot),
      saveDraft: vi.fn(),
      finalize: vi.fn(),
    };
    let resolveReload!: (result: CloseoutSnapshot) => void;
    const reloadingClient: CloseoutClient = {
      getCloseout: vi.fn(
        () =>
          new Promise<CloseoutSnapshot>((resolve) => {
            resolveReload = resolve;
          }),
      ),
      saveDraft: vi.fn(),
      finalize: vi.fn(),
    };

    const { rerender } = render(
      <CashUpPanel client={client} onFinalized={vi.fn()} />,
    );
    expect(await screen.findByRole("table", { name: "Transactions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();

    rerender(
      <CashUpPanel client={reloadingClient} onFinalized={vi.fn()} />,
    );

    expect(
      await screen.findByRole("table", { name: "Loading transactions" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("spinbutton", { name: "Drawer Count" })).toBeDisabled();
    expect(screen.getByLabelText("Explanation")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    resolveReload(savedSnapshot);
    expect(await screen.findByRole("table", { name: "Transactions" })).toBeInTheDocument();
  });

  it("submits an unchanged saved draft without saving it again", async () => {
    const savedSnapshot: CloseoutSnapshot = {
      ...snapshot,
      countedCashMinor: 15025,
      varianceMinor: 275,
      explanation: "Recounted",
    };
    const finalizedSnapshot: CloseoutSnapshot = {
      ...savedSnapshot,
      status: "finalized",
      finalizedAtUtc: "2026-11-06T14:00:00Z",
    };
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(savedSnapshot),
      saveDraft: vi.fn(),
      finalize: vi.fn().mockResolvedValue(finalizedSnapshot),
    };
    const onFinalized = vi.fn();

    render(<CashUpPanel client={client} onFinalized={onFinalized} />);

    const submitButton = await screen.findByRole("button", { name: "Submit" });
    expect(submitButton).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Changed after save" },
    });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Recounted" },
    });
    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);

    expect(
      await screen.findByText(
        "This will finalize this counter and no other changes may be made. Would you like to continue?",
      ),
    ).toBeInTheDocument();
    expect(client.finalize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(await screen.findByRole("button", { name: "Submit" })).toBeDisabled();
    const finalizedTime = screen.getByText(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date("2026-11-06T14:00:00Z")) + " UTC",
    );
    expect(finalizedTime).toHaveAttribute("datetime", "2026-11-06T14:00:00Z");
    expect(client.saveDraft).not.toHaveBeenCalled();
    expect(client.finalize).toHaveBeenCalledOnce();
    expect(onFinalized).toHaveBeenCalledOnce();
    expect(onFinalized).toHaveBeenCalledWith(finalizedSnapshot);
  });

  it("shows a finalization error without saving the draft again", async () => {
    const savedSnapshot: CloseoutSnapshot = {
      ...snapshot,
      countedCashMinor: 15025,
      varianceMinor: 275,
      explanation: "Recounted",
    };
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(savedSnapshot),
      saveDraft: vi.fn(),
      finalize: vi.fn().mockRejectedValue(new Error("Finalize failed")),
    };

    render(<CashUpPanel client={client} onFinalized={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "OK" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Finalize failed");
    expect(client.saveDraft).not.toHaveBeenCalled();
    expect(client.finalize).toHaveBeenCalledOnce();
  });

  it("does not finalize when the submit confirmation is canceled", async () => {
    const savedSnapshot: CloseoutSnapshot = {
      ...snapshot,
      countedCashMinor: 15025,
      varianceMinor: 275,
      explanation: "Recounted",
    };
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(savedSnapshot),
      saveDraft: vi.fn(),
      finalize: vi.fn(),
    };

    render(<CashUpPanel client={client} onFinalized={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(client.finalize).not.toHaveBeenCalled();
    await waitForElementToBeRemoved(dialog);
  });

  it("enables Save only for a valid changed count with a variance explanation", async () => {
    const savedSnapshot: CloseoutSnapshot = {
      ...snapshot,
      countedCashMinor: 15025,
      varianceMinor: 275,
      explanation: "Recounted",
    };
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(snapshot),
      saveDraft: vi.fn().mockResolvedValue(savedSnapshot),
      finalize: vi.fn(),
    };

    render(<CashUpPanel client={client} onFinalized={vi.fn()} />);

    const saveButton = await screen.findByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByRole("spinbutton", { name: "Drawer Count" }), {
      target: { value: "150.25" },
    });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Recounted" },
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    expect(client.saveDraft).toHaveBeenCalledWith({
      countedCashMinor: 15025,
      explanation: "Recounted",
    });
    expect(await screen.findByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("enables Save when only the explanation changes from the saved draft", async () => {
    const savedSnapshot: CloseoutSnapshot = {
      ...snapshot,
      countedCashMinor: 15025,
      varianceMinor: 275,
      explanation: "Recounted",
    };
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(savedSnapshot),
      saveDraft: vi.fn().mockResolvedValue(savedSnapshot),
      finalize: vi.fn(),
    };

    render(<CashUpPanel client={client} onFinalized={vi.fn()} />);

    const saveButton = await screen.findByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Recounted a second time" },
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    expect(client.saveDraft).toHaveBeenCalledWith({
      countedCashMinor: 15025,
      explanation: "Recounted a second time",
    });
  });

  it("displays API validation messages when saving fails", async () => {
    const client: CloseoutClient = {
      getCloseout: vi.fn().mockResolvedValue(snapshot),
      saveDraft: vi.fn().mockRejectedValue(
        new ApiError(400, {
          title: "Validation failed",
          errors: {
            countedCashMinor: ["The count is outside the allowed range."],
          },
        }),
      ),
      finalize: vi.fn(),
    };

    render(<CashUpPanel client={client} onFinalized={vi.fn()} />);
    fireEvent.change(await screen.findByRole("spinbutton", { name: "Drawer Count" }), {
      target: { value: "150.25" },
    });
    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Recounted" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The count is outside the allowed range.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "An unexpected error occurred.",
    );
  });
});
