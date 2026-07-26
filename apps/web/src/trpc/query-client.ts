import { QueryClient } from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
