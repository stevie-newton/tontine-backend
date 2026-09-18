"""Bound the complete multipart request before Starlette spools uploaded files."""
from fastapi import HTTPException, Request
from fastapi.routing import APIRoute


class ProofUploadRoute(APIRoute):
    MAX_REQUEST_BYTES = 5 * 1024 * 1024 + 64 * 1024

    def get_route_handler(self):
        handler = super().get_route_handler()
        if self.path != "/contributions/with-proof":
            return handler

        async def bounded_upload(request: Request):
            body = bytearray()
            async for chunk in request.stream():
                if len(body) + len(chunk) > self.MAX_REQUEST_BYTES:
                    raise HTTPException(status_code=413, detail="Payment screenshot must be 5 MB or smaller")
                body.extend(chunk)

            async def receive():
                return {"type": "http.request", "body": bytes(body), "more_body": False}

            return await handler(Request(request.scope, receive))

        return bounded_upload
