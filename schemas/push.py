from pydantic import BaseModel, Field


class WebPushKeys(BaseModel):
    p256dh: str = Field(..., min_length=1)
    auth: str = Field(..., min_length=1)


class WebPushSubscriptionCreate(BaseModel):
    endpoint: str = Field(..., min_length=10)
    keys: WebPushKeys
    expirationTime: float | None = None


class WebPushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=10)


class WebPushSubscribeResponse(BaseModel):
    subscribed: bool


class WebPushTestResponse(BaseModel):
    subscriptions: int
    sent: int
    failed: int
    web_subscriptions: int = 0
    mobile_devices: int = 0


class MobilePushDeviceCreate(BaseModel):
    expo_push_token: str = Field(..., min_length=10)
    platform: str = Field(..., pattern="^(android|ios)$")
    device_name: str | None = Field(default=None, max_length=255)
    app_version: str | None = Field(default=None, max_length=50)


class MobilePushUnsubscribeRequest(BaseModel):
    expo_push_token: str = Field(..., min_length=10)


class MobilePushSubscribeResponse(BaseModel):
    subscribed: bool


class MobilePushStatusResponse(BaseModel):
    subscribed: bool
    devices: int
