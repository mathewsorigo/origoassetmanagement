import { createFileRoute } from "@tanstack/react-router";
import { dispatch } from "@/lib/hermes-v1.server";

const handle = ({ request, params }: { request: Request; params: { _splat?: string } }) =>
  dispatch(request, params._splat ?? "");

export const Route = createFileRoute("/api/public/hermes/v1/$")({
  server: {
    handlers: { GET: handle, POST: handle, PATCH: handle, DELETE: handle },
  },
});
