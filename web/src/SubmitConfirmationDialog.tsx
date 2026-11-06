import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

export interface SubmitConfirmationDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SubmitConfirmationDialog({
  open,
  onCancel,
  onConfirm,
}: SubmitConfirmationDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="submit-confirmation-title"
      aria-describedby="submit-confirmation-description"
    >
      <DialogTitle id="submit-confirmation-title">
        Confirm submission
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="submit-confirmation-description">
          This will finalize this counter and no other changes may be made.
          Would you like to continue?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained" autoFocus>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
