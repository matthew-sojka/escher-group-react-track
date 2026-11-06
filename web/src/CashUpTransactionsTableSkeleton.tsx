import {
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

export function CashUpTransactionsTableSkeleton() {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table aria-label="Loading transactions" aria-busy="true">
        <TableHead>
          <TableRow>
            <TableCell>Description</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {[0, 1, 2].map((row) => (
            <TableRow key={row}>
              <TableCell>
                <Skeleton animation="wave" />
              </TableCell>
              <TableCell>
                <Skeleton animation="wave" width="60%" />
              </TableCell>
              <TableCell align="right">
                <Skeleton animation="wave" width="70%" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
