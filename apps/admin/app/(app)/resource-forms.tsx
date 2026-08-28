"use client";

import { Alert } from "@aurbit/ui/alert";
import { Button } from "@aurbit/ui/button";
import { FormField } from "@aurbit/ui/form-field";
import { Input } from "@aurbit/ui/input";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createOrganizationAction,
  createProjectAction,
  updateProjectAction,
  type ResourceActionState,
} from "./actions";

const initialState: ResourceActionState = {};

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button className="mt-1 w-full sm:w-auto" disabled={pending}>
      {pending ? "Saving…" : children}
    </Button>
  );
}

function ResourceMessage({ state }: { state: ResourceActionState }) {
  if (state.error) return <Alert role="alert">{state.error}</Alert>;
  if (state.success)
    return (
      <Alert role="status" variant="success">
        {state.success}
      </Alert>
    );
  return null;
}

function NameField({
  defaultValue,
  error,
  id,
  label,
}: {
  defaultValue?: string;
  error?: string | string[];
  id: string;
  label: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <FormField error={error} id={id} label={label}>
      <Input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={id === "organization-name" ? "organization" : undefined}
        id={id}
        maxLength={80}
        name="name"
        onChange={(event) => setValue(event.target.value)}
        placeholder={
          id === "organization-name" ? "Acme Inc." : "Customer dashboard"
        }
        required
        value={value}
      />
    </FormField>
  );
}

export function OrganizationForm() {
  const [state, action] = useActionState(
    createOrganizationAction,
    initialState,
  );
  return (
    <form action={action} className="grid gap-5" noValidate>
      <NameField
        error={state.fieldErrors?.name}
        id="organization-name"
        label="Workspace name"
      />
      <ResourceMessage state={state} />
      <SubmitButton>Create workspace</SubmitButton>
    </form>
  );
}

export function ProjectForm({ organizationId }: { organizationId: string }) {
  const [state, action] = useActionState(createProjectAction, initialState);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <input name="organizationId" type="hidden" value={organizationId} />
      <NameField
        error={state.fieldErrors?.name}
        id="project-name"
        label="Project name"
      />
      <ResourceMessage state={state} />
      <SubmitButton>Create project</SubmitButton>
    </form>
  );
}

export function EditProjectForm({
  organizationId,
  projectId,
  name,
}: {
  organizationId: string;
  projectId: string;
  name: string;
}) {
  const [state, action] = useActionState(updateProjectAction, initialState);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="projectId" type="hidden" value={projectId} />
      <NameField
        defaultValue={name}
        error={state.fieldErrors?.name}
        id="project-name"
        label="Project name"
      />
      <ResourceMessage state={state} />
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}
