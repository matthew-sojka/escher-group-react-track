import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import type { CashTransaction } from "./contracts";
import { formatCurrencyAmount } from "./utils";

export interface CashUpTransactionsTableProps {
  transactions: CashTransaction[];
  currency: string;
}

export function CashUpTransactionsTable({
  transactions,
  currency,
}: CashUpTransactionsTableProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table aria-labelledby="transactions-heading">
        <TableHead>
          <TableRow>
            <TableCell>Description</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} align="center">
                No transactions
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{transaction.description}</TableCell>
                <TableCell>
                  {transaction.kind === "sale" ? "Sale" : "Refund"}
                </TableCell>
                <TableCell align="right">
                  {formatCurrencyAmount(
                    transaction.kind === "refund"
                      ? -transaction.amountMinor
                      : transaction.amountMinor,
                    currency,
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
