from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PreDeadlineReminder(BaseModel):
    cycle_id: int
    tontine_id: int
    tontine_name: str
    cycle_number: int
    deadline: datetime
    hours_remaining: int = Field(..., ge=0)

    model_config = ConfigDict(from_attributes=True)


class PreDeadlineRemindersResponse(BaseModel):
    lookahead_hours: int
    server_time: datetime
    reminders: list[PreDeadlineReminder]

    model_config = ConfigDict(from_attributes=True)

