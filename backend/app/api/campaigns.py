from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import List

from ..models.database import Campaign, SendLog, User
from ..services.telegram_service import TelegramService
from ..core.config import settings
from .schemas import (
    CampaignCreate, 
    CampaignResponse, 
    CampaignList,
    CampaignStatus,
    CampaignControl
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.post("/", response_model=CampaignResponse)
async def create_campaign(
    data: CampaignCreate,
    db: AsyncSession = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """Создание новой рассылки"""
    if db is None or current_user is None:
        raise HTTPException(status_code=500, detail="Not configured")
    
    # Валидация данных
    if data.mode == "single" and len(data.messages) != 1:
        raise HTTPException(status_code=400, detail="Single mode requires exactly 1 message")
    
    if data.mode == "rotating" and len(data.messages) < 2:
        raise HTTPException(status_code=400, detail="Rotating mode requires at least 2 messages")
    
    campaign = Campaign(
        user_id=current_user.id,
        name=data.name,
        mode=data.mode,
        messages=data.messages,
        chat_links=data.chat_links,
        delay_seconds=data.delay_seconds,
        send_mode=data.send_mode,
        status="pending"
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
        stats={"total": len(data.chat_links), "sent": 0, "failed": 0}
    )


@router.get("/", response_model=CampaignList)
async def list_campaigns(
    db: AsyncSession = Depends(lambda: None),
    current_user: User = Depends(lambda: None),
    limit: int = 50
):
    """Получение списка рассылок"""
    if db is None or current_user is None:
        raise HTTPException(status_code=500, detail="Not configured")
    
    stmt = select(Campaign).where(
        Campaign.user_id == current_user.id
    ).order_by(Campaign.created_at.desc()).limit(limit)
    
    result = await db.execute(stmt)
    campaigns = result.scalars().all()
    
    campaign_list = []
    for c in campaigns:
        # Получаем статистику
        log_stmt = select(SendLog).where(SendLog.campaign_id == c.id)
        log_result = await db.execute(log_stmt)
        logs = log_result.scalars().all()
        
        sent = len([l for l in logs if l.status == "success"])
        failed = len([l for l in logs if l.status == "failed"])
        
        campaign_list.append(CampaignResponse(
            id=c.id,
            name=c.name,
            mode=c.mode,
            status=c.status,
            created_at=c.created_at,
            stats={"total": len(c.chat_links), "sent": sent, "failed": failed}
        ))
    
    return CampaignList(campaigns=campaign_list)


@router.get("/{campaign_id}", response_model=CampaignStatus)
async def get_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """Получение статуса рассылки"""
    if db is None or current_user is None:
        raise HTTPException(status_code=500, detail="Not configured")
    
    stmt = select(Campaign).where(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Получаем логи
    log_stmt = select(SendLog).where(
        SendLog.campaign_id == campaign_id
    ).order_by(SendLog.sent_at.desc()).limit(100)
    
    log_result = await db.execute(log_stmt)
    logs = log_result.scalars().all()
    
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
    db: AsyncSession = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """Запуск рассылки"""
    if db is None or current_user is None:
        raise HTTPException(status_code=500, detail="Not configured")
    
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
    
    campaign.status = "running"
    await db.commit()
    
    # Запускаем рассылку в фоне
    # TODO: Использовать Celery для production
    # Для прототипа - простой background task
    # background_tasks.add_task(run_campaign, campaign_id, db)
    
    return {"status": "started", "campaign_id": campaign_id}


@router.post("/control")
async def control_campaign(
    data: CampaignControl,
    db: AsyncSession = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """Управление рассылкой (pause/resume/stop)"""
    if db is None or current_user is None:
        raise HTTPException(status_code=500, detail="Not configured")
    
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
    
    await db.commit()
    
    return {"status": "ok", "campaign_id": campaign.id, "new_status": campaign.status}


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(lambda: None),
    current_user: User = Depends(lambda: None)
):
    """Удаление рассылки"""
    if db is None or current_user is None:
        raise HTTPException(status_code=500, detail="Not configured")
    
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
