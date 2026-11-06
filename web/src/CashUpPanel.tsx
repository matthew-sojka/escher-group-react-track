import { useEffect, useRef, useState } from "react";
import { Alert, Button, TextField } from "@mui/material";
import type { ChangeEvent, FocusEvent } from "react";
import { ApiError } from "./api";
import type { CloseoutClient, CloseoutSnapshot } from "./contracts";
import { SubmitConfirmationDialog } from "./SubmitConfirmationDialog";
import { CashUpTransactionsTable } from "./CashUpTransactionsTable";
import { CashUpTransactionsTableSkeleton } from "./CashUpTransactionsTableSkeleton";
import {
  formatCashInput,
  formatCurrencyAmount,
  formatTimestamp,
} from "./utils";

export interface CashUpPanelProps {
  client: CloseoutClient;
  onFinalized: (snapshot: CloseoutSnapshot) => void;
}

// This enum is used to avoid stringly-typed comparisons in the component.
enum SnapshotStatus {
  Draft = "draft",
  Finalized = "finalized",
}

// Handle API errors and validation errors from the server.
function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const fieldErrors = Object.values(error.errors).flat();
    return fieldErrors.length > 0 ? fieldErrors.join(" ") : error.message;
  }
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

export function CashUpPanel({ client, onFinalized }: CashUpPanelProps) {
  const [snapshot, setSnapshot] = useState<CloseoutSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [countInput, setCountInput] = useState("");
  const [explanationInput, setExplanationInput] = useState("");
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const hasNotifiedFinalized = useRef(false);
  const onFinalizedRef = useRef(onFinalized);
  onFinalizedRef.current = onFinalized;

  const observeFinalized = (result: CloseoutSnapshot) => {
    setSnapshot(result);
    if (
      result.status === SnapshotStatus.Finalized &&
      !hasNotifiedFinalized.current
    ) {
      hasNotifiedFinalized.current = true;
      onFinalizedRef.current(result);
    }
  };

  // Reload the closeout when the client changes or a retry is requested.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    client.getCloseout(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) {
          observeFinalized(result);
          setCountInput(
            result.countedCashMinor === null
              ? ""
              : formatCashInput(result.countedCashMinor),
          );
          setExplanationInput(result.explanation);
          setLoading(false);
        }
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(reason));
          setLoading(false);
        }
      },
    );

    return () => controller.abort();
  }, [client, retry]);

  // Parse a nonnegative amount with up to two decimal places into minor units.
  const parseCount = (value: string): number | null => {
    const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(value);
    if (!match) {
      return null;
    }

    const amountMinor =
      Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
    return Number.isSafeInteger(amountMinor) ? amountMinor : null;
  };

  // Handle input changes for the drawer count and explanation fields.
  const handleDrawerCountInput = (event: ChangeEvent<HTMLInputElement>) => {
    setCountInput(event.target.value);
  };

  const handleDrawerCountBlur = (event: FocusEvent<HTMLInputElement>) => {
    const amountMinor = parseCount(event.target.value);
    if (amountMinor !== null) {
      setCountInput(formatCashInput(amountMinor));
    }
  };
  const handleExplanationInput = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setExplanationInput(event.target.value);
  };


  const countedCashMinor = parseCount(countInput);
  const drawerCountError =
    snapshot !== null &&
    snapshot.countedCashMinor !== null &&
    countedCashMinor === null &&
    countInput.trim() === "";
  const varianceMinor =
    countedCashMinor === null || !snapshot
      ? null
      : countedCashMinor - snapshot.expectedCashMinor;
  const explanationError =
    snapshot !== null &&
    explanationInput !== snapshot.explanation &&
    countedCashMinor !== null &&
    varianceMinor !== null &&
    // A nonzero variance requires an explanation; zero variance does not allow one.
    ((varianceMinor !== 0 && explanationInput.trim() === "") ||
      (varianceMinor === 0 && explanationInput.trim() !== ""));
  const explanationErrorMessage =
    // Explain the validation rule for the current variance.
    varianceMinor === 0
      ? "Not Applicable."
      : "Enter an explanation for the variance.";
  const hasUnsavedChanges =
    snapshot !== null &&
    // Compare the current count and explanation with the saved snapshot.
    (countedCashMinor !== snapshot.countedCashMinor ||
      explanationInput !== snapshot.explanation);
  const saveDisabled =
    // Saving requires a valid count, any required explanation, and changed values.
    saving ||
    snapshot?.status === SnapshotStatus.Finalized ||
    countedCashMinor === null ||
    (varianceMinor !== null &&
      varianceMinor !== 0 &&
      explanationInput.trim() === "") ||
    !hasUnsavedChanges;
  const submitDisabled =
    // Submission requires an unchanged draft with a count and any required explanation.
    saving ||
    snapshot?.status !== SnapshotStatus.Draft ||
    hasUnsavedChanges ||
    snapshot.countedCashMinor === null ||
    (snapshot.varianceMinor !== 0 && snapshot.explanation.trim() === "");

  // Save the current draft and update the snapshot and input fields.
  const saveDraft = async (): Promise<CloseoutSnapshot> => {
    if (countedCashMinor === null) {
      throw new Error(
        "Enter a valid nonnegative drawer count with up to two decimal places.",
      );
    }

    const savedSnapshot = await client.saveDraft({
      countedCashMinor,
      explanation: explanationInput,
    });
    observeFinalized(savedSnapshot);
    setCountInput(
      savedSnapshot.countedCashMinor === null
        ? ""
        : formatCashInput(savedSnapshot.countedCashMinor),
    );
    setExplanationInput(savedSnapshot.explanation);
    return savedSnapshot;
  };

  // Save the current draft.
  const handleSave = async () => {
    setSaving(true);
    setActionError(null);
    try {
      await saveDraft();
    } catch (reason: unknown) {
      setActionError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  // Open the confirmation dialog before finalizing the cash-up.
  const handleSubmit = () => {
    setConfirmSubmitOpen(true);
  };

  // Finalize the current draft after the user confirms submission.
  const handleConfirmSubmit = async () => {
    setConfirmSubmitOpen(false);
    setSaving(true);
    setActionError(null);
    try {
      const finalizedSnapshot = await client.finalize();
      observeFinalized(finalizedSnapshot);
    } catch (reason: unknown) {
      setActionError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="cash-up-panel" aria-labelledby="cash-up-heading">
      <h2 id="cash-up-heading">Cash up this counter</h2>
      {snapshot && (
        <div className="cash-up-field-group">
          <p>
            <strong>Opening Cash</strong>
            <span>
              {formatCurrencyAmount(
                snapshot.openingCashMinor,
                snapshot.currency,
              )}
            </span>
          </p>
        </div>
      )}
      <h3 id="transactions-heading">Transactions</h3>

      {error && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setRetry((previous) => previous + 1)}
              disabled={loading}
            >
              Retry
            </Button>
          }
        >
          Could not load transactions: {error}
        </Alert>
      )}

      {snapshot && (
        <>
          {/* Show the table skeleton while loading, then the transactions table. */}
          {loading && <CashUpTransactionsTableSkeleton />}
          {!loading && (
            <CashUpTransactionsTable
              transactions={snapshot.transactions}
              currency={snapshot.currency}
            />
          )}

          <div className="cash-up-details">
            <div className="cash-up-field-group">
              <p>
                <strong>Expected Cash</strong>
                <span>
                  {formatCurrencyAmount(
                    snapshot.expectedCashMinor,
                    snapshot.currency,
                  )}
                </span>
              </p>
            </div>

            <div className="cash-up-field-group">
              <div className="cash-up-field-row">
                <label htmlFor="drawer-count">Drawer Count</label>
                <TextField
                  id="drawer-count"
                  placeholder="0.00"
                  type="number"
                  value={countInput}
                  onChange={handleDrawerCountInput}
                  onBlur={handleDrawerCountBlur}
                  error={drawerCountError}
                  helperText={
                    drawerCountError ? "Enter a drawer count." : undefined
                  }
                  slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                  fullWidth
                  disabled={
                    loading ||
                    saving ||
                    snapshot.status === SnapshotStatus.Finalized
                  }
                />
              </div>
            </div>
            <div className="cash-up-field-group">
              <p aria-live="polite">
                <strong>Variance</strong>
                <span className="cash-up-variance-value">
                  <span>
                    {varianceMinor === null
                      ? "--"
                      : formatCurrencyAmount(
                          varianceMinor,
                          snapshot.currency,
                        )}
                  </span>
                  {varianceMinor !== null && (
                    <strong
                      className={
                        varianceMinor === 0
                          ? "cash-up-variance-status cash-up-variance-match"
                          : "cash-up-variance-status"
                      }
                    >
                      {varianceMinor === 0
                        ? "Match"
                        : varianceMinor > 0
                          ? "Surplus"
                          : "Shortage"}
                    </strong>
                  )}
                </span>
              </p>
            </div>
            <div className="cash-up-field-group">
              <div className="cash-up-field-row">
                <label htmlFor="drawer-explanation">Explanation</label>
                <TextField
                  id="drawer-explanation"
                  placeholder="Enter explanation for variance"
                  multiline
                  minRows={3}
                  value={explanationInput}
                  onChange={handleExplanationInput}
                  error={explanationError}
                  helperText={
                    explanationError ? explanationErrorMessage : undefined
                  }
                  fullWidth
                  disabled={
                    loading ||
                    saving ||
                    snapshot.status === SnapshotStatus.Finalized
                  }
                />
              </div>
            </div>
          </div>

          <div className="cash-up-actions">
            <Button
              variant="outlined"
              onClick={handleSave}
              disabled={loading || saveDisabled}
            >
              Save
            </Button>
            <div className="cash-up-submit-group">
              <Button
                variant="contained"
                  onClick={handleSubmit}
                disabled={loading || submitDisabled}
              >
                Submit
              </Button>
            </div>
          </div>

          {/* Show an error alert if saving or submission fails. */}
          {actionError && (
            <Alert severity="error" role="alert" sx={{ mt: 2 }}>
              {actionError}
            </Alert>
          )}

          {snapshot.status === SnapshotStatus.Finalized &&
            snapshot.finalizedAtUtc && (
              <span className="cash-up-finalized-at">
                Finalized at{" "}
                <time dateTime={snapshot.finalizedAtUtc}>
                  {formatTimestamp(snapshot.finalizedAtUtc)}
                </time>
              </span>
            )}

          {/* Confirm before finalizing the cash-up. */}
          <SubmitConfirmationDialog
            open={confirmSubmitOpen}
            onCancel={() => setConfirmSubmitOpen(false)}
            onConfirm={handleConfirmSubmit}
          />
        </>
      )}
    </section>
  );
}
