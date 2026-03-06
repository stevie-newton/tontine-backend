def test_admin_reminder_preview_requires_global_admin(client, db_session, current_user):
    current_user.is_global_admin = False
    db_session.add(current_user)
    db_session.commit()
    db_session.refresh(current_user)

    response = client.get("/admin/stats/reminders/pre-deadline/preview")
    assert response.status_code == 403
    assert response.json()["detail"] == "Global admin access required"


def test_admin_reminder_endpoints_work_for_global_admin(client, db_session, current_user, monkeypatch):
    current_user.is_global_admin = True
    db_session.add(current_user)
    db_session.commit()

    monkeypatch.setattr(
        "app.routes.admin_stats.list_pre_deadline_sms_targets",
        lambda db: {"cycles_count": 0, "targets_count": 0, "cycles": []},
    )
    monkeypatch.setattr(
        "app.routes.admin_stats.send_pre_deadline_sms_reminders",
        lambda db: {"sms_configured": True, "cycles_checked": 0, "sms_sent": 0, "sms_failed": 0, "cycles_marked": 0},
    )

    preview = client.get("/admin/stats/reminders/pre-deadline/preview")
    assert preview.status_code == 200
    assert preview.json()["cycles_count"] == 0

    send_now = client.post("/admin/stats/reminders/pre-deadline/send")
    assert send_now.status_code == 200
    assert send_now.json()["sms_configured"] is True
