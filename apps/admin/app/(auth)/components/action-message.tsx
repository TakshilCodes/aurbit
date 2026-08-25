import { Alert } from "@aurbit/ui/alert";
import type { AuthActionState } from "../actions";

export function ActionMessage({ state }: { state: AuthActionState }) {
  if (state.error) {
    return <Alert role="alert">{state.error}</Alert>;
  }

  if (state.success) {
    return (
      <Alert role="status" variant="success">
        {state.success}
      </Alert>
    );
  }

  return null;
}
