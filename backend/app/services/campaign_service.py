"""Campaign sending service"""
import asyncio
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from pyrogram import Client
from pyrogram.errors import FloodWait, PeerIdInvalid, UsernameNotOccupied, UserNotParticipant, Flood

from ..models.database import Campaign, SendLog, User, TelegramSession
from .telegram_service import decrypt_session


# Tier limits
TIER_LIMITS = {
    "free": {"max_chats": 3, "daily_limit": 10, "log_retention_hours": 0.5},  # 30 minutes
    "basic": {"max_chats": 15, "daily_limit": 300, "log_retention_hours": 72},  # 3 days
    "vip": {"max_chats": 30, "daily_limit": 1000, "log_retention_hours": 360},  # 15 days
}

# In-memory storage for running campaigns (campaign_id -> status)
_running_campaigns: Dict[int, str] = {}  # campaign_id -> status


def get_tier_limits(tier: str) -> dict:
    """Get limits for a tier"""
    return TIER_LIMITS.get(tier, TIER_LIMITS["free"])


def get_jitter_for_tier(tier: str) -> int:
    """Get default jitter based on tier (for free tier)"""
    if tier == "free":
        return 2
    return 0  # For basic/vip, jitter is configurable


async def check_campaign_limits(db: AsyncSession, user: User, campaign: Campaign) -> tuple[bool, str]:
    """Check if user can start this campaign based on tier limits"""
    tier = user.tier or "free"
    limits = get_tier_limits(tier)
    
    # Check chat count limit
    chat_count = len(campaign.chat_links) if campaign.chat_links else 0
    if chat_count > limits["max_chats"]:
        return False, f"Превышен лимит чатов: максимум {limits['max_chats']} для тарифа {tier}"
    
    # Check daily message limit
    one_day_ago = datetime.utcnow() - timedelta(hours=24)
    logs_stmt = select(SendLog).where(
        and_(
            SendLog.user_id == user.id,
            SendLog.status == "success",
            SendLog.sent_at >= one_day_ago
        )
    )
    logs_result = await db.execute(logs_stmt)
    sent_today = len(logs_result.scalars().all())
    
    total_to_send = chat_count * (len(campaign.messages) if campaign.messages else 1)
    if sent_today + total_to_send > limits["daily_limit"]:
        remaining = limits["daily_limit"] - sent_today
        return False, f"Превышен дневной лимит: осталось {remaining} сообщений из {limits['daily_limit']}"
    
    return True, ""


async def get_telegram_client(db: AsyncSession, user_id: int) -> Optional[Client]:
    """Get and initialize Telegram client from user's session"""
    stmt = select(TelegramSession).where(
        and_(
            TelegramSession.user_id == user_id,
            TelegramSession.is_active == True
        )
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    
    if not session:
        return None
    
    try:
        session_string = decrypt_session(session.encrypted_session)
        client = Client(
            name=f"user_{user_id}",
            session_string=session_string,
            no_updates=True,
        )
        await client.start()
        return client
    except Exception as e:
        print(f"Failed to initialize Telegram client: {e}")
        return None


async def log_send(
    db: AsyncSession,
    campaign_id: int,
    user_id: int,
    chat_id: str,
    chat_title: str,
    message_index: int,
    status: str,
    error_message: Optional[str] = None
):
    """Log a send attempt"""
    log = SendLog(
        user_id=user_id,
        campaign_id=campaign_id,
        chat_id=str(chat_id),
        chat_title=chat_title,
        message_index=message_index,
        status=status,
        error_message=error_message,
        sent_at=datetime.utcnow()
    )
    db.add(log)
    await db.commit()


async def send_with_retry(
    client: Client,
    chat_id: str,
    text: str,
    campaign_id: int,
    user_id: int,
    db: AsyncSession,
    chat_title: str = ""
) -> bool:
    """Send message with FloodWait handling"""
    try:
        await client.send_message(chat_id, text)
        await log_send(db, campaign_id, user_id, chat_id, chat_title, 0, "success")
        return True
    except FloodWait as e:
        await log_send(db, campaign_id, user_id, chat_id, chat_title, 0, "flood_wait", 
                      f"FloodWait: пауза {e.value} секунд")
        await asyncio.sleep(e.value)
        try:
            await client.send_message(chat_id, text)
            await log_send(db, campaign_id, user_id, chat_id, chat_title, 0, "success")
            return True
        except Exception as e2:
            await log_send(db, campaign_id, user_id, chat_id, chat_title, 0, "error",
                          f"Повторная ошибка после FloodWait: {str(e2)}")
            return False
    except (PeerIdInvalid, UsernameNotOccupied, UserNotParticipant) as e:
        await log_send(db, campaign_id, user_id, chat_id, chat_title, 0, "skipped", str(e))
        return False
    except Exception as e:
        await log_send(db, campaign_id, user_id, chat_id, chat_title, 0, "error", str(e))
        return False


async def calculate_delay(base_delay: int, jitter: int) -> float:
    """Calculate actual delay with jitter"""
    if jitter <= 0:
        return float(base_delay)
    
    actual = base_delay + random.uniform(-jitter, jitter)
    return max(1.0, actual)  # Minimum 1 second


async def send_campaign(
    db: AsyncSession,
    campaign: Campaign,
    user: User,
):
    """Main campaign sending logic - runs in a loop until stopped"""
    campaign_id = campaign.id
    user_id = user.id
    tier = user.tier or "free"
    iteration = 0
    
    # Mark campaign as running
    _running_campaigns[campaign_id] = "running"
    campaign.status = "running"
    campaign.started_at = datetime.utcnow()
    await db.commit()
    
    client = await get_telegram_client(db, user_id)
    if not client:
        campaign.status = "failed"
        await db.commit()
        _running_campaigns.pop(campaign_id, None)
        return {"success": False, "error": "Telegram не подключен"}
    
    try:
        messages = campaign.messages or []
        chat_links = campaign.chat_links or []
        base_delay = campaign.delay_seconds or 10
        jitter = campaign.jitter_seconds or get_jitter_for_tier(tier)
        send_mode = campaign.send_mode or "sequential"
        
        # Main loop - continues until stopped
        while _running_campaigns.get(campaign_id) != "stopped":
            iteration += 1
            print(f"Campaign {campaign_id}: Starting iteration {iteration}")
            
            if send_mode == "all_at_once":
                # Send to all chats simultaneously
                tasks = []
                for chat_link in chat_links:
                    if _running_campaigns.get(campaign_id) == "stopped":
                        break
                    task = send_to_chat(client, campaign_id, user_id, chat_link, messages, 
                                        base_delay, jitter, db)
                    tasks.append(task)
                
                if tasks:
                    results = await asyncio.gather(*tasks, return_exceptions=True)
            else:
                # Sequential sending
                for i, chat_link in enumerate(chat_links):
                    if _running_campaigns.get(campaign_id) == "stopped":
                        break
                    
                    await send_to_chat(client, campaign_id, user_id, chat_link, messages,
                                     base_delay, jitter, db)
                    
                    # Delay between chats (except for the last one)
                    if i < len(chat_links) - 1:
                        delay = await calculate_delay(base_delay, jitter)
                        await asyncio.sleep(delay)
            
            # Check if stopped before waiting for next iteration
            if _running_campaigns.get(campaign_id) == "stopped":
                break
            
            # Check if end time has been reached
            if campaign.ends_at:
                ends_dt = campaign.ends_at
                if ends_dt.tzinfo is not None:
                    ends_dt = ends_dt.replace(tzinfo=None)
                if datetime.utcnow() >= ends_dt:
                    print(f"Campaign {campaign_id}: End time reached, stopping")
                    _running_campaigns[campaign_id] = "stopped"
                    break
            
            # Wait for next iteration - delay between full cycles
            print(f"Campaign {campaign_id}: Completed iteration {iteration}, waiting {base_delay} seconds for next cycle")
            await asyncio.sleep(base_delay)
        
        # Campaign was stopped
        campaign.status = "stopped"
        await db.commit()
        
    except Exception as e:
        campaign.status = "failed"
        await db.commit()
        return {"success": False, "error": str(e)}
    finally:
        if client.is_connected:
            await client.stop()
        _running_campaigns.pop(campaign_id, None)
    
    return {"success": True}


async def send_to_chat(
    client: Client,
    campaign_id: int,
    user_id: int,
    chat_link: str,
    messages: List[str],
    base_delay: int,
    jitter: int,
    db: AsyncSession
):
    """Send messages to a single chat"""
    chat_id = extract_chat_id(chat_link)
    chat_title = ""
    
    # Get chat info
    try:
        chat = await client.get_chat(chat_id)
        chat_title = chat.title or chat.first_name or str(chat_id)
    except:
        pass
    
    # Send messages with delay
    for i, message in enumerate(messages):
        if _running_campaigns.get(campaign_id) == "stopped":
            break
        
        success = await send_with_retry(client, chat_id, message, campaign_id, user_id, db, chat_title)
        
        # Delay between messages in the same chat
        if i < len(messages) - 1 and success:
            delay = await calculate_delay(base_delay, jitter)
            await asyncio.sleep(delay)


def extract_chat_id(chat_link: str) -> str:
    """Extract chat ID/username from various link formats"""
    # Remove common prefixes
    chat_link = chat_link.strip()
    
    if chat_link.startswith("https://t.me/"):
        chat_link = chat_link.replace("https://t.me/", "")
    elif chat_link.startswith("t.me/"):
        chat_link = chat_link.replace("t.me/", "")
    elif chat_link.startswith("@"):
        pass
    elif chat_link.startswith("-"):
        return chat_link  # It's a numeric ID
    
    return chat_link


async def stop_campaign(campaign_id: int):
    """Stop a running campaign"""
    _running_campaigns[campaign_id] = "stopped"


def is_campaign_running(campaign_id: int) -> bool:
    """Check if campaign is running"""
    return _running_campaigns.get(campaign_id) == "running"


def is_campaign_stopped(campaign_id: int) -> bool:
    """Check if campaign was stopped"""
    return _running_campaigns.get(campaign_id) == "stopped"
