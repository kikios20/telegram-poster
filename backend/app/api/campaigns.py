from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import List
import asyncio

from ..core import get_db
from ..models.database import Campaign, SendLog, User
from ..services.campaign_service import (
    send_campaign, stop_campaign, check_campaign_limits,
    get_tier_limits, get_jitter_for_tier
)
from .schemas import (
    CampaignCreate, 
    CampaignResponse, 
    CampaignList,
    CampaignStatus,
    CampaignControl
)
from .auth import get_current_user

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.post("/", response_model=CampaignResponse)
async def create_campaign(
    data: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание новой рассылки"""
    tier = current_user.tier or "free"
    
    # Валидация данных
    if data.mode == "single" and len(data.messages) != 1:
        raise HTTPException(status_code=400, detail="Single mode requires exactly 1 message")
    
    if data.mode == "rotating" and len(data.messages) < 2:
        raise HTTPException(status_code=400, detail="Rotating mode requires at least 2 messages")
    
    # Determine jitter based on tier
    jitter = data.jitter_seconds if data.jitter_seconds is not None else get_jitter_for_tier(tier)
    
    # Validate jitter for tier
    limits = get_tier_limits(tier)
    if tier == "free":
        jitter = 2  # Fixed for free tier
    elif tier == "basic" and jitter > 10:
        raise HTTPException(status_code=400, detail="Jitter cannot exceed 10 seconds for basic tier")
    elif tier == "vip" and jitter > 30:
        raise HTTPException(status_code=400, detail="Jitter cannot exceed 30 seconds for VIP tier")
    
    # Validate chat count limit for tier
    chat_count = len(data.chat_links) if data.chat_links else 0
    if chat_count > limits["max_chats"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Превышен лимит чатов: максимум {limits['max_chats']} для тарифа {tier}"
        )
    
    # Determine initial status
    now = datetime.utcnow()
    initial_status = "pending"
    if data.scheduled_at:
        # Convert to naive datetime for comparison if needed
        scheduled_dt = data.scheduled_at
        if scheduled_dt.tzinfo is not None:
            scheduled_dt = scheduled_dt.replace(tzinfo=None)
        if scheduled_dt > now:
            initial_status = "scheduled"
    
    campaign = Campaign(
        user_id=current_user.id,
        name=data.name,
        mode=data.mode,
        messages=data.messages,
        chat_links=data.chat_links,
        delay_seconds=data.delay_seconds,
        jitter_seconds=jitter,
        send_mode=data.send_mode,
        status=initial_status,
        scheduled_at=data.scheduled_at,
        ends_at=data.ends_at
    )
    
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    
    return CampaignResponse(
        id=campaign.id,
        name=campaign.name,
        mode=campaign.mode,
        status=campaign.status,
        created_at=campaign.created_at,
        stats={"total": len(data.chat_links), "sent": 0, "failed": 0},
        scheduled_at=campaign.scheduled_at,
        ends_at=campaign.ends_at
    )


@router.get("/", response_model=CampaignList)
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50
):
    """Получение списка рассылок"""
    tier = current_user.tier or "free"
    limits = get_tier_limits(tier)
    
    stmt = select(Campaign).where(
        Campaign.user_id == current_user.id
    ).order_by(Campaign.created_at.desc()).limit(limit)
    
    result = await db.execute(stmt)
    campaigns = result.scalars().all()
    
    campaign_list = []
    for c in campaigns:
        # Filter logs by retention period
        log_stmt = select(SendLog).where(
            SendLog.campaign_id == c.id
        ).order_by(SendLog.sent_at.desc())
        log_result = await db.execute(log_stmt)
        logs = log_result.scalars().all()
        
        # Filter by retention
        from datetime import timedelta
        retention_cutoff = datetime.utcnow() - timedelta(hours=limits["log_retention_hours"])
        logs = [l for l in logs if l.sent_at and l.sent_at >= retention_cutoff]
        
        sent = len([l for l in logs if l.status == "success"])
        failed = len([l for l in logs if l.status == "failed"])
        
        campaign_list.append(CampaignResponse(
            id=c.id,
            name=c.name,
            mode=c.mode,
            status=c.status,
            created_at=c.created_at,
            stats={"total": len(c.chat_links), "sent": sent, "failed": failed},
            scheduled_at=c.scheduled_at,
            ends_at=c.ends_at
        ))
    
    return CampaignList(campaigns=campaign_list)


@router.get("/{campaign_id}", response_model=CampaignStatus)
async def get_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение статуса рассылки"""
    tier = current_user.tier or "free"
    limits = get_tier_limits(tier)
    
    stmt = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Получаем логи с учётом retention
    log_stmt = select(SendLog).where(
        SendLog.campaign_id == campaign_id
    ).order_by(SendLog.sent_at.desc()).limit(100)
    
    log_result = await db.execute(log_stmt)
    logs = log_result.scalars().all()
    
    # Filter by retention
    from datetime import timedelta
    retention_cutoff = datetime.utcnow() - timedelta(hours=limits["log_retention_hours"])
    logs = [l for l in logs if l.sent_at and l.sent_at >= retention_cutoff]
    
    sent = len([l for l in logs if l.status == "success"])
    failed = len([l for l in logs if l.status == "failed"])
    
    return CampaignStatus(
        campaign_id=campaign.id,
        status=campaign.status,
        progress={
            "total": len(campaign.chat_links),
            "sent": sent,
            "failed": failed,
            "remaining": len(campaign.chat_links) - sent - failed
        },
        logs=[{
            "chat_id": l.chat_id,
            "chat_title": l.chat_title,
            "status": l.status,
            "sent_at": l.sent_at.isoformat() if l.sent_at else None,
            "error": l.error_message
        } for l in logs]
    )


@router.post("/{campaign_id}/start")
async def start_campaign(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Запуск рассылки"""
    stmt = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status not in ["pending", "paused"]:
        raise HTTPException(status_code=400, detail="Campaign cannot be started")
    
    # Check tier limits
    can_start, error_msg = await check_campaign_limits(db, current_user, campaign)
    if not can_start:
        raise HTTPException(status_code=403, detail=error_msg)
    
    # Update campaign status
    campaign.status = "running"
    await db.commit()
    
    # Start sending in background
    async def run_campaign():
        try:
            await send_campaign(db, campaign, current_user)
        except Exception as e:
            print(f"Campaign {campaign_id} failed: {e}")
            campaign.status = "failed"
            await db.commit()
    
    asyncio.create_task(run_campaign())
    
    return {"status": "started", "campaign_id": campaign_id}


@router.post("/{campaign_id}/stop")
async def stop_campaign_endpoint(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Остановка рассылки"""
    stmt = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status != "running":
        raise HTTPException(status_code=400, detail="Campaign is not running")
    
    # Stop the campaign
    await stop_campaign(campaign_id)
    campaign.status = "stopped"
    await db.commit()
    
    return {"status": "stopped", "campaign_id": campaign_id}


@router.post("/control")
async def control_campaign(
    data: CampaignControl,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Управление рассылкой (pause/resume/stop)"""
    stmt = select(Campaign).where(
        Campaign.id == data.campaign_id,
        Campaign.user_id == current_user.id
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if data.action == "pause":
        if campaign.status != "running":
            raise HTTPException(status_code=400, detail="Campaign is not running")
        campaign.status = "paused"
    elif data.action == "resume":
        if campaign.status != "paused":
            raise HTTPException(status_code=400, detail="Campaign is not paused")
        campaign.status = "running"
    elif data.action == "stop":
        if campaign.status not in ["running", "paused"]:
            raise HTTPException(status_code=400, detail="Campaign cannot be stopped")
        campaign.status = "stopped"
        await stop_campaign(data.campaign_id)
    
    await db.commit()
    
    return {"status": "ok", "campaign_id": campaign.id, "new_status": campaign.status}


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удаление рассылки"""
    stmt = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status == "running":
        raise HTTPException(status_code=400, detail="Cannot delete running campaign")
    
    await db.delete(campaign)
    await db.commit()
    
    return {"status": "deleted"}


@router.get("/{campaign_id}/export-csv")
async def export_campaign_logs_csv(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Экспорт логов рассылки в CSV"""
    from fastapi.responses import StreamingResponse
    from datetime import timedelta
    import io
    import csv
    
    # Status translation map
    STATUS_TRANSLATIONS = {
        "success": "Успешно",
        "failed": "Ошибка",
        "error": "Ошибка",
        "pending": "Ожидание",
        "skipped": "Пропущено",
        "flood_wait": "FloodWait"
    }
    
    # Get tier limits for retention
    tier = current_user.tier or "free"
    limits = get_tier_limits(tier)
    
    # Get campaign
    stmt = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get messages for the campaign
    messages = campaign.messages or []
    
    # Get logs with retention filter
    log_stmt = select(SendLog).where(
        SendLog.campaign_id == campaign_id
    ).order_by(SendLog.sent_at.asc())
    
    log_result = await db.execute(log_stmt)
    logs = log_result.scalars().all()
    
    # Filter by retention
    retention_cutoff = datetime.utcnow() - timedelta(hours=limits["log_retention_hours"])
    logs = [l for l in logs if l.sent_at and l.sent_at >= retention_cutoff]
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header with UTF-8 BOM for Excel compatibility
    writer.writerow(['ID', 'Чат', 'Название чата', 'Сообщение', 'Статус', 'Время отправки', 'Ошибка'])
    
    # Data
    for log in logs:
        # Get message text (truncated to 50 chars if too long)
        msg_idx = log.message_index if log.message_index is not None else 0
        msg_text = messages[msg_idx] if messages and msg_idx < len(messages) else f"#{msg_idx + 1}"
        if len(msg_text) > 50:
            msg_text = msg_text[:47] + "..."
        
        # Translate status
        status_translated = STATUS_TRANSLATIONS.get(log.status, log.status)
        
        writer.writerow([
            log.id,
            log.chat_id,
            log.chat_title or '',
            msg_text,
            status_translated,
            log.sent_at.strftime('%Y-%m-%d %H:%M:%S') if log.sent_at else '',
            log.error_message or ''
        ])
    
    # Prepare response
    output.seek(0)
    filename = f"campaign_{campaign_id}_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )
