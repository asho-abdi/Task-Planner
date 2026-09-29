import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function createQueryClient() {
  return new QueryClient({
    // Every failed mutation surfaces feedback, even where a view has no inline error slot.
    mutationCache: new MutationCache({
      onError: (error) => {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Something went wrong. Please try again.";
        toast.error(message, { id: `mutation-error:${message}` });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
