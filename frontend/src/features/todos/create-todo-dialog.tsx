"use client";

import { CreateResourceDialog } from "@/components/create-resource-dialog";
import { useCreateTodo } from "@/features/todos/hooks";
import {
  emptyTodoForm,
  TodoForm,
  toTodoWriteInput,
} from "@/features/todos/todo-form";

type CreateTodoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateTodoDialog({
  open,
  onOpenChange,
}: CreateTodoDialogProps) {
  const createTodo = useCreateTodo();

  return (
    <CreateResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New todo"
      description="Personal to this workspace."
    >
      <TodoForm
        key={open ? "open" : "closed"}
        initial={emptyTodoForm()}
        submitting={createTodo.isPending}
        submitLabel="Create"
        error={createTodo.error?.message}
        onSubmit={async (values) => {
          try {
            await createTodo.mutateAsync(toTodoWriteInput(values));
            onOpenChange(false);
          } catch {
            // Error is shown from the mutation.
          }
        }}
      />
    </CreateResourceDialog>
  );
}
